import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Building2, Plus, Save, Trash2, Users, RotateCcw, ZoomIn, ZoomOut,
  Stethoscope, Scissors, Coffee, Microscope, Bed, DoorOpen,
  Briefcase, Bath, Move, MapPin, Loader2, Check, X, Sparkles,
  ImagePlus, Upload, Type as TypeIcon, Image as ImageIcon, Palette,
  Phone as PhoneIcon, Mail as MailIcon, Clock as ClockIcon, MessageSquare,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { supabase } from '../../../lib/supabase';

// ─── Theme ────────────────────────────────────────────────────
const ACCENT   = '#F4A261';
const ACCENT_D = '#C2671A';

// ─── Floor plan grid ──────────────────────────────────────────
// The canvas is a fixed-aspect grid: 40 columns × 24 rows.
// One cell ≈ 1 m² in real-world terms. Cell size in CSS pixels
// scales with the viewport via the zoom slider.
const GRID_COLS = 40;
const GRID_ROWS = 24;
const DEFAULT_CELL_PX = 22;
const MIN_CELL_PX = 12;
const MAX_CELL_PX = 36;

// ─── Room types ──────────────────────────────────────────────
type RoomType =
  | 'exam' | 'surgery' | 'reception' | 'lab' | 'kennel'
  | 'office' | 'restroom' | 'lobby' | 'storage' | 'other';

interface RoomTypeConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  defaultW: number;
  defaultH: number;
}

const ROOM_TYPES: Record<RoomType, RoomTypeConfig> = {
  exam:      { label: 'Exam Room',  icon: Stethoscope, color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 18%, transparent)', defaultW: 5, defaultH: 4 },
  surgery:   { label: 'Surgery',    icon: Scissors,    color: '#EC4899',                  bg: 'color-mix(in srgb, #EC4899 18%, transparent)',                  defaultW: 7, defaultH: 5 },
  reception: { label: 'Reception',  icon: DoorOpen,    color: '#F4A261',                  bg: 'color-mix(in srgb, #F4A261 18%, transparent)',                  defaultW: 6, defaultH: 4 },
  lab:       { label: 'Lab',        icon: Microscope,  color: '#8B5CF6',                  bg: 'color-mix(in srgb, #8B5CF6 18%, transparent)',                  defaultW: 5, defaultH: 4 },
  kennel:    { label: 'Kennel',     icon: Bed,         color: '#06B6D4',                  bg: 'color-mix(in srgb, #06B6D4 18%, transparent)',                  defaultW: 6, defaultH: 4 },
  office:    { label: 'Office',     icon: Briefcase,   color: '#3B82F6',                  bg: 'color-mix(in srgb, #3B82F6 18%, transparent)',                  defaultW: 4, defaultH: 4 },
  restroom:  { label: 'Restroom',   icon: Bath,        color: '#6B7280',                  bg: 'color-mix(in srgb, #6B7280 22%, transparent)',                  defaultW: 3, defaultH: 3 },
  lobby:     { label: 'Lobby',      icon: Coffee,      color: '#F59E0B',                  bg: 'color-mix(in srgb, #F59E0B 18%, transparent)',                  defaultW: 8, defaultH: 5 },
  storage:   { label: 'Storage',    icon: Sparkles,    color: '#94A3B8',                  bg: 'color-mix(in srgb, #94A3B8 22%, transparent)',                  defaultW: 4, defaultH: 3 },
  other:     { label: 'Other',      icon: Building2,   color: '#64748B',                  bg: 'color-mix(in srgb, #64748B 22%, transparent)',                  defaultW: 4, defaultH: 4 },
};

// ─── Types ────────────────────────────────────────────────────
interface BusinessHourRow {
  day: string;
  open: string | null;
  close: string | null;
}

interface Clinic {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
  banner_image_url: string | null;
  banner_gradient: string | null;
  banner_text: string | null;
  logo_image_url: string | null;
  // Contact info (used by the owner Contact Clinic page)
  tagline: string | null;
  phone: string | null;
  emergency_phone: string | null;
  email: string | null;
  map_url: string | null;
  business_hours: BusinessHourRow[] | null;
}

// Shape the contact editor persists back to clinics
interface ContactDraft {
  name: string;
  tagline: string | null;
  phone: string | null;
  emergency_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  map_url: string | null;
  business_hours: BusinessHourRow[];
}

const DEFAULT_BUSINESS_HOURS: BusinessHourRow[] = [
  { day: 'Monday',    open: '8:00 AM', close: '6:00 PM' },
  { day: 'Tuesday',   open: '8:00 AM', close: '6:00 PM' },
  { day: 'Wednesday', open: '8:00 AM', close: '7:00 PM' },
  { day: 'Thursday',  open: '8:00 AM', close: '6:00 PM' },
  { day: 'Friday',    open: '8:00 AM', close: '5:00 PM' },
  { day: 'Saturday',  open: '9:00 AM', close: '3:00 PM' },
  { day: 'Sunday',    open: null,       close: null },
];

// ─── Banner gradient presets ──────────────────────────────────
const BANNER_PRESETS: { id: string; label: string; gradient: string }[] = [
  { id: 'forest',   label: 'Forest',   gradient: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #52B788 100%)' },
  { id: 'ocean',    label: 'Ocean',    gradient: 'linear-gradient(135deg, #0C4A6E 0%, #0369A1 50%, #38BDF8 100%)' },
  { id: 'sunset',   label: 'Sunset',   gradient: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 50%, #FB923C 100%)' },
  { id: 'lavender', label: 'Lavender', gradient: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #A78BFA 100%)' },
  { id: 'rose',     label: 'Rose',     gradient: 'linear-gradient(135deg, #881337 0%, #BE123C 50%, #FB7185 100%)' },
  { id: 'slate',    label: 'Slate',    gradient: 'linear-gradient(135deg, #0F172A 0%, #334155 50%, #94A3B8 100%)' },
  { id: 'mint',     label: 'Mint',     gradient: 'linear-gradient(135deg, #064E3B 0%, #059669 50%, #6EE7B7 100%)' },
  { id: 'amber',    label: 'Amber',    gradient: 'linear-gradient(135deg, #78350F 0%, #B45309 50%, #FCD34D 100%)' },
];

const DEFAULT_BANNER_GRADIENT = BANNER_PRESETS[0].gradient;

// Editor draft (mirrors the four banner columns from clinics)
interface BannerDraft {
  banner_image_url: string | null;
  banner_gradient: string | null;
  banner_text: string | null;
  logo_image_url: string | null;
}

interface StaffMember {
  id: string;          // staff.id
  profile_id: string;
  first_name: string;
  last_name: string;
  role: string;
  job_title: string | null;
  photo_url: string | null;
  avatar_color: string | null;
  clinic_id: string | null;
}

interface Room {
  id: string;
  organization_id: string;
  clinic_id: string;
  name: string;
  type: RoomType;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  color: string | null;
  staff_ids: string[];
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────
function clampToGrid(val: number, max: number): number {
  return Math.max(0, Math.min(val, max));
}
function getInitials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}
function isVet(role: string): boolean {
  return role === 'veterinarian' || role === 'senior_veterinarian' || role === 'specialist' || role === 'lead_vet_tech';
}

// ─── Page ─────────────────────────────────────────────────────
export default function SuperAdminClinicsPage() {
  const db = useTenantDb();

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);

  // Banner editor state
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Contact info editor state
  const [contactSaving, setContactSaving] = useState(false);

  // Drag state for moving + resizing rooms
  const dragRef = useRef<{
    mode: 'move' | 'resize';
    roomId: string;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data: cl } = await db
          .from('clinics')
          .select('id, name, city, address, is_active, banner_image_url, banner_gradient, banner_text, logo_image_url, tagline, phone, emergency_phone, email, map_url, business_hours')
          .eq('organization_id', organizationId)
          .order('name');
        if (!alive) return;
        const list = (cl ?? []) as Clinic[];
        setClinics(list);
        if (list.length > 0) setSelectedClinicId(list[0].id);

        // staff for assignment
        const { data: st } = await db
          .from('staff')
          .select('id, profile_id, first_name, last_name, role, job_title, photo_url, avatar_color, clinic_id')
          .eq('organization_id', organizationId)
          .order('first_name');
        if (!alive) return;
        setStaff((st ?? []) as StaffMember[]);
      } catch (e) {
        console.error('[clinics] load failed:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [db]);

  // ── Load rooms whenever the selected clinic changes ────────
  useEffect(() => {
    if (!selectedClinicId) { setRooms([]); return; }
    let alive = true;
    (async () => {
      const { organizationId } = await getOrgContext();
      const { data, error } = await db
        .from('clinic_rooms')
        .select('id, organization_id, clinic_id, name, type, pos_x, pos_y, width, height, color, staff_ids, notes')
        .eq('organization_id', organizationId)
        .eq('clinic_id', selectedClinicId)
        .order('created_at', { ascending: true });
      if (!alive) return;
      if (error) {
        console.error('[clinics] rooms load failed:', error.message);
        setRooms([]);
        return;
      }
      setRooms((data ?? []) as Room[]);
      setSelectedRoomId(null);
    })();
    return () => { alive = false; };
  }, [db, selectedClinicId]);

  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId) ?? null, [clinics, selectedClinicId]);
  const selectedRoom = useMemo(() => rooms.find(r => r.id === selectedRoomId) ?? null, [rooms, selectedRoomId]);

  const staffById = useMemo(() => {
    const m = new Map<string, StaffMember>();
    for (const s of staff) m.set(s.id, s);
    return m;
  }, [staff]);

  // ── Persistence helpers ────────────────────────────────────
  const persistRoom = useCallback(async (room: Room) => {
    setSavingId(room.id);
    try {
      const { error } = await db
        .from('clinic_rooms')
        .update({
          name: room.name,
          type: room.type,
          pos_x: room.pos_x,
          pos_y: room.pos_y,
          width: room.width,
          height: room.height,
          color: room.color,
          staff_ids: room.staff_ids,
          notes: room.notes,
        })
        .eq('id', room.id);
      if (error) console.error('[clinics] save failed:', error.message);
    } finally {
      setSavingId(null);
    }
  }, [db]);

  // ── Add a room from the palette (drag-end on canvas) ───────
  const addRoomAt = useCallback(async (type: RoomType, posX: number, posY: number) => {
    if (!selectedClinicId) return;
    const cfg = ROOM_TYPES[type];
    const { organizationId } = await getOrgContext();
    const w = cfg.defaultW;
    const h = cfg.defaultH;
    const newRoom: Omit<Room, 'id'> = {
      organization_id: organizationId,
      clinic_id: selectedClinicId,
      name: cfg.label,
      type,
      pos_x: clampToGrid(posX, GRID_COLS - w),
      pos_y: clampToGrid(posY, GRID_ROWS - h),
      width: w,
      height: h,
      color: null,
      staff_ids: [],
      notes: null,
    };
    const { data, error } = await db
      .from('clinic_rooms')
      .insert(newRoom)
      .select('id, organization_id, clinic_id, name, type, pos_x, pos_y, width, height, color, staff_ids, notes')
      .single();
    if (error || !data) {
      console.error('[clinics] add room failed:', error?.message);
      return;
    }
    setRooms(prev => [...prev, data as Room]);
    setSelectedRoomId((data as Room).id);
  }, [db, selectedClinicId]);

  const deleteRoom = useCallback(async (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
    if (selectedRoomId === id) setSelectedRoomId(null);
    await db.from('clinic_rooms').delete().eq('id', id);
  }, [db, selectedRoomId]);

  const updateRoomLocal = useCallback((id: string, patch: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  // ── Banner: explicit save (no auto-save) ───────────────────
  // Persists the full draft from the editor and updates local state on success.
  const saveBannerDraft = useCallback(async (id: string, draft: BannerDraft) => {
    setBannerSaving(true);
    try {
      const { error } = await db
        .from('clinics')
        .update({
          banner_image_url: draft.banner_image_url,
          banner_gradient: draft.banner_gradient,
          banner_text: draft.banner_text,
          logo_image_url: draft.logo_image_url,
        })
        .eq('id', id);
      if (error) {
        console.error('[clinics] banner save failed:', error.message);
        return;
      }
      // Mirror into the in-memory clinics list so the editor's "saved" baseline
      // matches what is now in the database.
      setClinics(prev => prev.map(c => c.id === id ? { ...c, ...draft } : c));
    } finally {
      setBannerSaving(false);
    }
  }, [db]);

  // ── Contact info: explicit save ─────────────────────────────
  // Persists all editable clinic presentation fields (name, tagline, phone,
  // emergency phone, email, address, city, map URL, opening hours). The owner
  // "Contact Clinic" page reads these same columns.
  const saveContactDraft = useCallback(async (id: string, draft: ContactDraft) => {
    setContactSaving(true);
    try {
      const { error } = await db
        .from('clinics')
        .update({
          name: draft.name,
          tagline: draft.tagline,
          phone: draft.phone,
          emergency_phone: draft.emergency_phone,
          email: draft.email,
          address: draft.address,
          city: draft.city,
          map_url: draft.map_url,
          business_hours: draft.business_hours,
        })
        .eq('id', id);
      if (error) {
        console.error('[clinics] contact save failed:', error.message);
        return;
      }
      // Mirror into local state so the section's "saved" baseline matches the DB.
      setClinics(prev => prev.map(c => c.id === id ? {
        ...c,
        name: draft.name,
        tagline: draft.tagline,
        phone: draft.phone,
        emergency_phone: draft.emergency_phone,
        email: draft.email,
        address: draft.address,
        city: draft.city,
        map_url: draft.map_url,
        business_hours: draft.business_hours,
      } : c));
    } finally {
      setContactSaving(false);
    }
  }, [db]);

  // Image upload only writes to storage and returns the public URL — the URL
  // is put into the editor's local draft and is only written to the clinics
  // table when the user hits Save.
  const uploadBannerImage = useCallback(async (file: File): Promise<string | null> => {
    if (!selectedClinicId) return null;
    setBannerUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${selectedClinicId}/banner-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('clinic-banners')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (upErr) {
        console.error('[clinics] upload failed:', upErr.message);
        return null;
      }
      const { data: urlData } = supabase.storage.from('clinic-banners').getPublicUrl(path);
      return urlData.publicUrl;
    } finally {
      setBannerUploading(false);
    }
  }, [selectedClinicId]);

  // Logo upload (PNG / SVG) → goes to a separate bucket. Same draft pattern:
  // returns the public URL, the editor stores it locally, the Save button persists.
  // After uploading, every other file in this clinic's logo folder is removed so
  // each clinic always has exactly one logo file (no orphans accumulate).
  const uploadClinicLogo = useCallback(async (file: File): Promise<string | null> => {
    if (!selectedClinicId) return null;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const newPath = `${selectedClinicId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('clinic-logos')
        .upload(newPath, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (upErr) {
        console.error('[clinics] logo upload failed:', upErr.message);
        return null;
      }

      // Cleanup: remove every other file in this clinic's folder.
      // We keep ONLY the file we just uploaded.
      try {
        const { data: listed } = await supabase.storage
          .from('clinic-logos')
          .list(selectedClinicId, { limit: 100 });
        if (listed && listed.length > 0) {
          const stalePaths = listed
            .map(f => `${selectedClinicId}/${f.name}`)
            .filter(p => p !== newPath);
          if (stalePaths.length > 0) {
            const { error: delErr } = await supabase.storage
              .from('clinic-logos')
              .remove(stalePaths);
            if (delErr) {
              console.warn('[clinics] failed to remove stale logos:', delErr.message);
            }
          }
        }
      } catch (cleanupErr) {
        console.warn('[clinics] cleanup pass crashed:', cleanupErr);
      }

      const { data: urlData } = supabase.storage.from('clinic-logos').getPublicUrl(newPath);
      return urlData.publicUrl;
    } finally {
      setLogoUploading(false);
    }
  }, [selectedClinicId]);

  // Delete every file in the given clinic's logo folder. Used when the user
  // clicks the X (clear) button to remove their logo entirely.
  const deleteAllClinicLogos = useCallback(async (clinicId: string): Promise<void> => {
    try {
      const { data: listed } = await supabase.storage
        .from('clinic-logos')
        .list(clinicId, { limit: 100 });
      if (listed && listed.length > 0) {
        const paths = listed.map(f => `${clinicId}/${f.name}`);
        const { error: delErr } = await supabase.storage
          .from('clinic-logos')
          .remove(paths);
        if (delErr) {
          console.warn('[clinics] failed to clear clinic logo folder:', delErr.message);
        }
      }
    } catch (e) {
      console.warn('[clinics] deleteAllClinicLogos crashed:', e);
    }
  }, []);

  // ── Pointer-based move + resize ────────────────────────────
  function startMove(e: React.PointerEvent, room: Room) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode: 'move',
      roomId: room.id,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: room.pos_x,
      startPosY: room.pos_y,
      startW: room.width,
      startH: room.height,
    };
    setSelectedRoomId(room.id);
  }
  function startResize(e: React.PointerEvent, room: Room) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode: 'resize',
      roomId: room.id,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: room.pos_x,
      startPosY: room.pos_y,
      startW: room.width,
      startH: room.height,
    };
    setSelectedRoomId(room.id);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.startX) / cellPx);
    const dy = Math.round((e.clientY - d.startY) / cellPx);
    setRooms(prev => prev.map(r => {
      if (r.id !== d.roomId) return r;
      if (d.mode === 'move') {
        return {
          ...r,
          pos_x: clampToGrid(d.startPosX + dx, GRID_COLS - r.width),
          pos_y: clampToGrid(d.startPosY + dy, GRID_ROWS - r.height),
        };
      } else {
        const newW = Math.max(2, Math.min(GRID_COLS - r.pos_x, d.startW + dx));
        const newH = Math.max(2, Math.min(GRID_ROWS - r.pos_y, d.startH + dy));
        return { ...r, width: newW, height: newH };
      }
    }));
  }
  function onPointerUp() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const room = rooms.find(r => r.id === d.roomId);
    if (room) persistRoom(room);
  }

  // ── HTML5 drop from palette ────────────────────────────────
  function onCanvasDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('application/x-room-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }
  function onCanvasDrop(e: React.DragEvent) {
    const t = e.dataTransfer.getData('application/x-room-type') as RoomType;
    if (!t || !ROOM_TYPES[t]) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cfg = ROOM_TYPES[t];
    const gx = Math.round(cx / cellPx) - Math.floor(cfg.defaultW / 2);
    const gy = Math.round(cy / cellPx) - Math.floor(cfg.defaultH / 2);
    addRoomAt(t, gx, gy);
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)', gap: '10px' }}>
          <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} /> Loading clinic layout…
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Clinics &amp; Layout
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Customise branding, contact details, opening hours and floor plan for each location.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {selectedClinic && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <MapPin style={{ width: 12, height: 12 }} />
              {selectedClinic.city || selectedClinic.address || 'No address'}
            </div>
          )}
          <Button style={{ backgroundColor: ACCENT, borderColor: ACCENT, gap: '6px' }}>
            <Plus style={{ width: 15, height: 15 }} /> Add Clinic
          </Button>
        </div>
      </div>

      {/* ── Clinic switcher ── */}
      {clinics.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {clinics.map(c => {
            const isActive = c.id === selectedClinicId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClinicId(c.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '8px 14px', borderRadius: '9999px',
                  border: '1px solid',
                  borderColor: isActive ? ACCENT : 'var(--border-color)',
                  backgroundColor: isActive ? 'color-mix(in srgb, ' + ACCENT + ' 12%, transparent)' : 'var(--surface-white)',
                  color: isActive ? ACCENT_D : 'var(--text-primary)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Building2 style={{ width: 14, height: 14 }} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Section 1: Banner & Branding ── */}
      {selectedClinic && (
        <BannerEditorSection
          key={selectedClinic.id}
          clinic={selectedClinic}
          saving={bannerSaving}
          uploading={bannerUploading}
          logoUploading={logoUploading}
          fileInputRef={bannerFileInputRef}
          logoFileInputRef={logoFileInputRef}
          onSave={(draft) => saveBannerDraft(selectedClinic.id, draft)}
          onUpload={uploadBannerImage}
          onUploadLogo={uploadClinicLogo}
          onDeleteLogo={() => deleteAllClinicLogos(selectedClinic.id)}
        />
      )}

      {/* ── Section 2: Contact Info & Hours (mirrors owner Contact Clinic page) ── */}
      {selectedClinic && (
        <ContactInfoEditorSection
          key={`contact-${selectedClinic.id}`}
          clinic={selectedClinic}
          saving={contactSaving}
          onSave={(draft) => saveContactDraft(selectedClinic.id, draft)}
        />
      )}

      {/* ── Section 3: Floor Plan Builder ── */}
      <section style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
        {/* Section header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 style={{ width: 16, height: 16, color: ACCENT_D }} /> Floor Plan Builder
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Drag a room from the palette onto the canvas. Click any room to rename it or assign staff.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setCellPx(p => Math.max(MIN_CELL_PX, p - 2))}
              title="Zoom out"
              style={{ width: 30, height: 30, borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ZoomOut style={{ width: 14, height: 14 }} />
            </button>
            <button
              onClick={() => setCellPx(DEFAULT_CELL_PX)}
              title="Reset zoom"
              style={{ height: 30, padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              {Math.round((cellPx / DEFAULT_CELL_PX) * 100)}%
            </button>
            <button
              onClick={() => setCellPx(p => Math.min(MAX_CELL_PX, p + 2))}
              title="Zoom in"
              style={{ width: 30, height: 30, borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ZoomIn style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Builder body: palette | canvas | inspector */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedRoom ? '180px 1fr 280px' : '180px 1fr', minHeight: '560px' }}>
          {/* ── Palette ── */}
          <aside style={{ borderRight: '1px solid var(--border-color)', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--surface-elevated)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', padding: '0 4px' }}>
              Room Types
            </p>
            {(Object.keys(ROOM_TYPES) as RoomType[]).map(t => {
              const cfg = ROOM_TYPES[t];
              const Icon = cfg.icon;
              return (
                <div
                  key={t}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-room-type', t);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px',
                    backgroundColor: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    cursor: 'grab', userSelect: 'none',
                    transition: 'transform 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = cfg.color; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; }}
                  title="Drag onto the canvas"
                >
                  <div style={{ width: 24, height: 24, borderRadius: '6px', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 13, height: 13, color: cfg.color }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{cfg.label}</span>
                </div>
              );
            })}
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 'auto', padding: '10px 4px 0', borderTop: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Move style={{ width: 10, height: 10 }} /> Drag a tile, then drop it on the grid
            </p>
          </aside>

          {/* ── Canvas ── */}
          <div
            style={{
              backgroundColor: 'color-mix(in srgb, var(--surface-elevated) 50%, transparent)',
              padding: '16px',
              overflow: 'auto',
              position: 'relative',
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div
              ref={canvasRef}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
              onClick={() => setSelectedRoomId(null)}
              style={{
                position: 'relative',
                width: GRID_COLS * cellPx,
                height: GRID_ROWS * cellPx,
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundImage: `
                  linear-gradient(to right, color-mix(in srgb, var(--border-color) 50%, transparent) 1px, transparent 1px),
                  linear-gradient(to bottom, color-mix(in srgb, var(--border-color) 50%, transparent) 1px, transparent 1px)
                `,
                backgroundSize: `${cellPx}px ${cellPx}px`,
                margin: '0 auto',
              }}
            >
              {rooms.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', pointerEvents: 'none', gap: '6px' }}>
                  <Building2 style={{ width: 36, height: 36, opacity: 0.4 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>Empty floor plan</p>
                  <p style={{ fontSize: '12px' }}>Drag a room from the left to start building</p>
                </div>
              )}

              {rooms.map(room => {
                const cfg = ROOM_TYPES[room.type] ?? ROOM_TYPES.other;
                const Icon = cfg.icon;
                const isSelected = room.id === selectedRoomId;
                const assignedCount = room.staff_ids?.length ?? 0;
                return (
                  <div
                    key={room.id}
                    onPointerDown={(e) => startMove(e, room)}
                    onClick={(e) => { e.stopPropagation(); setSelectedRoomId(room.id); }}
                    style={{
                      position: 'absolute',
                      left: room.pos_x * cellPx,
                      top: room.pos_y * cellPx,
                      width: room.width * cellPx,
                      height: room.height * cellPx,
                      backgroundColor: room.color || cfg.bg,
                      border: `2px solid ${isSelected ? cfg.color : 'color-mix(in srgb, ' + cfg.color + ' 60%, transparent)'}`,
                      borderRadius: '6px',
                      cursor: dragRef.current?.mode === 'move' ? 'grabbing' : 'grab',
                      display: 'flex', flexDirection: 'column',
                      padding: '6px 8px',
                      overflow: 'hidden',
                      userSelect: 'none',
                      boxShadow: isSelected ? `0 0 0 3px color-mix(in srgb, ${cfg.color} 25%, transparent)` : 'none',
                      transition: 'box-shadow 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      <Icon style={{ width: 12, height: 12, color: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {room.name}
                      </span>
                    </div>
                    {assignedCount > 0 && (
                      <div style={{ display: 'flex', gap: '-4px', marginTop: 'auto', alignItems: 'center' }}>
                        {room.staff_ids.slice(0, 3).map((sid, idx) => {
                          const st = staffById.get(sid);
                          const initials = st ? getInitials(st.first_name, st.last_name) : '?';
                          const bg = st?.avatar_color || cfg.color;
                          return (
                            <div
                              key={sid}
                              title={st ? `${st.first_name} ${st.last_name}` : ''}
                              style={{
                                width: 18, height: 18, borderRadius: '50%',
                                backgroundColor: bg, color: '#fff',
                                fontSize: '9px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1.5px solid var(--surface-white)',
                                marginLeft: idx === 0 ? 0 : '-5px',
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                          );
                        })}
                        {assignedCount > 3 && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginLeft: '4px' }}>
                            +{assignedCount - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Resize handle */}
                    {isSelected && (
                      <div
                        onPointerDown={(e) => startResize(e, room)}
                        style={{
                          position: 'absolute', right: 0, bottom: 0,
                          width: 14, height: 14,
                          cursor: 'nwse-resize',
                          background: `linear-gradient(135deg, transparent 50%, ${cfg.color} 50%)`,
                          borderBottomRightRadius: '4px',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Inspector (only when a room is selected) ── */}
          {selectedRoom && (
            <aside style={{ borderLeft: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--surface-elevated)', overflowY: 'auto' }}>
              <RoomInspector
                key={selectedRoom.id}
                room={selectedRoom}
                staff={staff}
                staffById={staffById}
                saving={savingId === selectedRoom.id}
                onChange={(patch) => updateRoomLocal(selectedRoom.id, patch)}
                onSave={() => {
                  const r = rooms.find(x => x.id === selectedRoom.id);
                  if (r) persistRoom(r);
                }}
                onClose={() => setSelectedRoomId(null)}
                onDelete={() => deleteRoom(selectedRoom.id)}
              />
            </aside>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>{rooms.length} room{rooms.length === 1 ? '' : 's'} · {GRID_COLS}×{GRID_ROWS} grid</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {savingId ? (
              <><Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> Saving…</>
            ) : (
              <><Check style={{ width: 12, height: 12, color: 'var(--brand-green-text)' }} /> All changes saved</>
            )}
          </span>
        </div>
      </section>
    </div>
  );
}

// ─── Room Inspector ────────────────────────────────────────────
interface RoomInspectorProps {
  room: Room;
  staff: StaffMember[];
  staffById: Map<string, StaffMember>;
  saving: boolean;
  onChange: (patch: Partial<Room>) => void;
  onSave: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function RoomInspector({ room, staff, staffById, saving, onChange, onSave, onClose, onDelete }: RoomInspectorProps) {
  const cfg = ROOM_TYPES[room.type] ?? ROOM_TYPES.other;
  const [staffSearch, setStaffSearch] = useState('');

  const matching = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return staff.filter(s => {
      if (!q) return true;
      const full = `${s.first_name} ${s.last_name}`.toLowerCase();
      return full.includes(q) || (s.role || '').toLowerCase().includes(q);
    });
  }, [staff, staffSearch]);

  function toggleStaff(id: string) {
    const has = room.staff_ids.includes(id);
    onChange({ staff_ids: has ? room.staff_ids.filter(s => s !== id) : [...room.staff_ids, id] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '8px', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <cfg.icon style={{ width: 14, height: 14, color: cfg.color }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
            Room properties
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-white)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', flexShrink: 0,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* Name */}
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Room name</label>
        <Input
          value={room.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={onSave}
          placeholder="e.g. Exam Room 1"
          style={{ height: 32, fontSize: '13px' }}
        />
      </div>

      {/* Type */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
        <Select value={room.type} onValueChange={(v) => { onChange({ type: v as RoomType }); setTimeout(onSave, 0); }}>
          <SelectTrigger style={{ height: 32, fontSize: '13px' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROOM_TYPES) as RoomType[]).map(t => (
              <SelectItem key={t} value={t}>{ROOM_TYPES[t].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Size readout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Width (m)</label>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', padding: '6px 10px', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>{room.width}</div>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Height (m)</label>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', padding: '6px 10px', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>{room.height}</div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Notes</label>
        <Textarea
          value={room.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          onBlur={onSave}
          rows={2}
          placeholder="Optional details…"
          style={{ fontSize: '12px', minHeight: 50 }}
        />
      </div>

      {/* Staff assignment */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users style={{ width: 11, height: 11 }} /> Staff assigned
          </label>
          <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color }}>
            {room.staff_ids.length}
          </span>
        </div>

        <Input
          value={staffSearch}
          onChange={(e) => setStaffSearch(e.target.value)}
          placeholder="Search staff…"
          style={{ height: 30, fontSize: '12px', marginBottom: '6px' }}
        />

        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '2px' }}>
          {matching.length === 0 ? (
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '8px', textAlign: 'center' }}>No staff found</p>
          ) : matching.map(s => {
            const checked = room.staff_ids.includes(s.id);
            const initials = getInitials(s.first_name, s.last_name);
            const displayName = isVet(s.role) ? `Dr. ${s.first_name} ${s.last_name}` : `${s.first_name} ${s.last_name}`;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { toggleStaff(s.id); setTimeout(onSave, 0); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', borderRadius: '6px',
                  backgroundColor: checked ? 'color-mix(in srgb, ' + cfg.color + ' 12%, transparent)' : 'var(--surface-white)',
                  border: '1px solid',
                  borderColor: checked ? cfg.color : 'var(--border-color)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: s.avatar_color || '#94A3B8', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{(s.job_title || s.role || '').replace(/_/g, ' ')}</div>
                </div>
                {checked && <Check style={{ width: 13, height: 13, color: cfg.color, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <Button
          variant="outline"
          onClick={onDelete}
          style={{ flex: 1, gap: '6px', color: '#EF4444', borderColor: 'color-mix(in srgb, #EF4444 30%, transparent)' }}
        >
          <Trash2 style={{ width: 13, height: 13 }} /> Delete
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          style={{ flex: 1, gap: '6px', backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          {saving ? (
            <><Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> Saving</>
          ) : (
            <><Save style={{ width: 13, height: 13 }} /> Save</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Banner Editor Section ─────────────────────────────────────
interface BannerEditorSectionProps {
  clinic: Clinic;
  saving: boolean;
  uploading: boolean;
  logoUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  logoFileInputRef: React.RefObject<HTMLInputElement | null>;
  onSave: (draft: BannerDraft) => Promise<void>;
  onUpload: (file: File) => Promise<string | null>;
  onUploadLogo: (file: File) => Promise<string | null>;
  onDeleteLogo: () => Promise<void>;
}

function bannerDraftFrom(clinic: Clinic): BannerDraft {
  return {
    banner_image_url: clinic.banner_image_url,
    banner_gradient: clinic.banner_gradient,
    banner_text: clinic.banner_text,
    logo_image_url: clinic.logo_image_url,
  };
}

function BannerEditorSection({
  clinic, saving, uploading, logoUploading, fileInputRef, logoFileInputRef,
  onSave, onUpload, onUploadLogo, onDeleteLogo,
}: BannerEditorSectionProps) {
  // Local draft — only the Save button writes to the database.
  const [draft, setDraft] = useState<BannerDraft>(() => bannerDraftFrom(clinic));

  // If the parent swaps to a different clinic, or the persisted clinic
  // values change after a save, sync the draft baseline.
  useEffect(() => {
    setDraft(bannerDraftFrom(clinic));
  }, [clinic.id, clinic.banner_image_url, clinic.banner_gradient, clinic.banner_text, clinic.logo_image_url]);

  const isDirty =
    draft.banner_image_url !== clinic.banner_image_url ||
    (draft.banner_gradient || null) !== (clinic.banner_gradient || null) ||
    (draft.banner_text || '') !== (clinic.banner_text || '') ||
    (draft.logo_image_url || null) !== (clinic.logo_image_url || null);

  const gradient = draft.banner_gradient || DEFAULT_BANNER_GRADIENT;
  const hasImage = !!draft.banner_image_url;
  const logoUrl = draft.logo_image_url;
  const text = draft.banner_text || '';
  const bg = hasImage
    ? `url(${draft.banner_image_url}) center/cover no-repeat`
    : gradient;

  function patch(p: Partial<BannerDraft>) {
    setDraft(prev => ({ ...prev, ...p }));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    const url = await onUpload(f);
    if (url) patch({ banner_image_url: url });
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    const url = await onUploadLogo(f);
    if (url) patch({ logo_image_url: url });
  }

  function handleClearImage() {
    patch({ banner_image_url: null });
  }

  async function handleClearLogo() {
    patch({ logo_image_url: null });
    // Also wipe every file in the clinic's storage folder so we don't leave orphans.
    await onDeleteLogo();
  }

  function handleDiscard() {
    setDraft(bannerDraftFrom(clinic));
  }

  async function handleSave() {
    await onSave(draft);
  }

  return (
    <section style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
      {/* Section header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImagePlus style={{ width: 16, height: 16, color: ACCENT_D }} /> Banner &amp; Branding
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Customise the cover banner shown on your clients&rsquo; pet profile pages.
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {saving || uploading || logoUploading ? (
            <><Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> {uploading || logoUploading ? 'Uploading…' : 'Saving…'}</>
          ) : isDirty ? (
            <><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ACCENT }} /> Unsaved changes</>
          ) : (
            <><Check style={{ width: 12, height: 12, color: 'var(--brand-green-text)' }} /> Saved</>
          )}
        </span>
      </div>

      {/* Body: stacked — preview on top, controls below */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ── Live preview ── */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Live preview
          </p>
          <div style={{
            position: 'relative',
            height: '220px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            background: bg,
          }}>
            {/* Subtle paw pattern overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
              backgroundSize: '28px 28px',
              pointerEvents: 'none',
            }} />
            {/* Bottom fade */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.18))', pointerEvents: 'none' }} />

            {/* Centered clinic logo + text overlay */}
            {(logoUrl || text) && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '10px', textAlign: 'center', padding: '12px',
                pointerEvents: 'none',
              }}>
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Clinic logo"
                    style={{
                      maxWidth: 96,
                      maxHeight: 96,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.35))',
                    }}
                  />
                )}
                {text && (
                  <p style={{
                    color: '#fff', fontSize: '22px', fontWeight: 700,
                    textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                    margin: 0, maxWidth: '90%',
                  }}>
                    {text}
                  </p>
                )}
              </div>
            )}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '5px', lineHeight: 1.5 }}>
            <ImageIcon style={{ width: 11, height: 11, marginTop: '2px', flexShrink: 0 }} />
            <span>
              This is what pet owners will see at the top of every pet profile.
              <br />
              <span style={{ opacity: 0.85 }}>Recommended banner size: 1600&times;480px (landscape, JPG or PNG, &lt; 2&nbsp;MB).</span>
            </span>
          </p>
        </div>

        {/* ── Controls grid (4 cards) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
          {/* Image upload card */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <ImageIcon style={{ width: 11, height: 11 }} /> Background image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ flex: 1, gap: '6px', fontSize: '12px', height: 34 }}
              >
                {uploading ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> : <Upload style={{ width: 13, height: 13 }} />}
                {hasImage ? 'Replace image' : 'Upload image'}
              </Button>
              {hasImage && (
                <Button
                  variant="outline"
                  onClick={handleClearImage}
                  style={{ gap: '6px', fontSize: '12px', height: 34, color: '#EF4444', borderColor: 'color-mix(in srgb, #EF4444 30%, transparent)' }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </Button>
              )}
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              PNG / JPG / WebP &middot; uploaded to public storage
            </p>
          </div>

          {/* Gradient card */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <Palette style={{ width: 11, height: 11 }} /> Gradient {hasImage && <span style={{ fontSize: '10px', textTransform: 'none', fontWeight: 500, color: 'var(--text-secondary)' }}>(used when no image)</span>}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {BANNER_PRESETS.map(p => {
                const isActive = (draft.banner_gradient || DEFAULT_BANNER_GRADIENT) === p.gradient;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => patch({ banner_gradient: p.gradient })}
                    title={p.label}
                    style={{
                      height: 34, borderRadius: '8px',
                      background: p.gradient,
                      border: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                      cursor: 'pointer', position: 'relative',
                      boxShadow: isActive ? '0 0 0 2px color-mix(in srgb, ' + ACCENT + ' 25%, transparent)' : 'none',
                    }}
                  >
                    {isActive && (
                      <div style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check style={{ width: 9, height: 9, color: ACCENT }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinic logo upload card */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <ImagePlus style={{ width: 11, height: 11 }} /> Clinic logo
            </label>
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/png,image/svg+xml"
              style={{ display: 'none' }}
              onChange={handleLogoFile}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Logo thumbnail preview */}
              <div style={{
                width: 40, height: 40, borderRadius: '8px',
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, padding: 4, overflow: 'hidden',
              }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImagePlus style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
                <Button
                  variant="outline"
                  onClick={() => logoFileInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{ flex: 1, gap: '6px', fontSize: '12px', height: 34 }}
                >
                  {logoUploading ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> : <Upload style={{ width: 13, height: 13 }} />}
                  {logoUrl ? 'Replace logo' : 'Upload logo'}
                </Button>
                {logoUrl && (
                  <Button
                    variant="outline"
                    onClick={handleClearLogo}
                    style={{ gap: '6px', fontSize: '12px', height: 34, color: '#EF4444', borderColor: 'color-mix(in srgb, #EF4444 30%, transparent)' }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </Button>
                )}
              </div>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
              PNG or SVG &middot; recommended 256&times;256px (square, transparent)
              <br />
              Shown on the pet owner portal only
            </p>
          </div>

          {/* Overlay text card */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <TypeIcon style={{ width: 11, height: 11 }} /> Overlay text
            </label>
            <Input
              value={text}
              maxLength={60}
              onChange={(e) => patch({ banner_text: e.target.value })}
              placeholder="e.g. Welcome to Hugory Vet"
              style={{ height: 34, fontSize: '13px' }}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Optional &middot; up to 60 characters
            </p>
          </div>
        </div>
      </div>

      {/* Footer with explicit Save / Discard */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
        <Button
          variant="outline"
          onClick={handleDiscard}
          disabled={!isDirty || saving || uploading || logoUploading}
          style={{ gap: '6px', fontSize: '12px', height: 34 }}
        >
          <RotateCcw style={{ width: 13, height: 13 }} /> Discard
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving || uploading || logoUploading}
          style={{ gap: '6px', fontSize: '12px', height: 34, backgroundColor: ACCENT, borderColor: ACCENT, minWidth: 110 }}
        >
          {saving ? (
            <><Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> Saving</>
          ) : (
            <><Save style={{ width: 13, height: 13 }} /> Save changes</>
          )}
        </Button>
      </div>
    </section>
  );
}

// ─── Contact Info Editor Section ──────────────────────────────
// Editable clinic contact info + opening hours. Feeds the owner
// "Contact Clinic" page via the same columns on the clinics table.
interface ContactInfoEditorSectionProps {
  clinic: Clinic;
  saving: boolean;
  onSave: (draft: ContactDraft) => Promise<void>;
}

function contactDraftFrom(clinic: Clinic): ContactDraft {
  return {
    name: clinic.name || '',
    tagline: clinic.tagline,
    phone: clinic.phone,
    emergency_phone: clinic.emergency_phone,
    email: clinic.email,
    address: clinic.address,
    city: clinic.city,
    map_url: clinic.map_url,
    business_hours: (clinic.business_hours && clinic.business_hours.length > 0)
      ? clinic.business_hours
      : DEFAULT_BUSINESS_HOURS,
  };
}

function ContactInfoEditorSection({ clinic, saving, onSave }: ContactInfoEditorSectionProps) {
  const [draft, setDraft] = useState<ContactDraft>(() => contactDraftFrom(clinic));

  // Sync baseline when the selected clinic changes or after a save.
  useEffect(() => {
    setDraft(contactDraftFrom(clinic));
  }, [
    clinic.id, clinic.name, clinic.tagline, clinic.phone, clinic.emergency_phone,
    clinic.email, clinic.address, clinic.city, clinic.map_url, clinic.business_hours,
  ]);

  const baseline = contactDraftFrom(clinic);
  const isDirty =
    draft.name !== baseline.name ||
    (draft.tagline || '') !== (baseline.tagline || '') ||
    (draft.phone || '') !== (baseline.phone || '') ||
    (draft.emergency_phone || '') !== (baseline.emergency_phone || '') ||
    (draft.email || '') !== (baseline.email || '') ||
    (draft.address || '') !== (baseline.address || '') ||
    (draft.city || '') !== (baseline.city || '') ||
    (draft.map_url || '') !== (baseline.map_url || '') ||
    JSON.stringify(draft.business_hours) !== JSON.stringify(baseline.business_hours);

  function patch(p: Partial<ContactDraft>) {
    setDraft(prev => ({ ...prev, ...p }));
  }

  function updateHourRow(index: number, patchRow: Partial<BusinessHourRow>) {
    setDraft(prev => ({
      ...prev,
      business_hours: prev.business_hours.map((row, i) => i === index ? { ...row, ...patchRow } : row),
    }));
  }

  function toggleDayOpen(index: number) {
    const row = draft.business_hours[index];
    if (row.open && row.close) {
      updateHourRow(index, { open: null, close: null });
    } else {
      updateHourRow(index, { open: '9:00 AM', close: '5:00 PM' });
    }
  }

  function handleDiscard() {
    setDraft(contactDraftFrom(clinic));
  }

  async function handleSave() {
    await onSave(draft);
  }

  return (
    <section style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
      {/* Section header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare style={{ width: 16, height: 16, color: ACCENT_D }} /> Contact Info &amp; Hours
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            These details appear on the pet owner&rsquo;s Contact Clinic page.
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {saving ? (
            <><Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> Saving…</>
          ) : isDirty ? (
            <><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ACCENT }} /> Unsaved changes</>
          ) : (
            <><Check style={{ width: 12, height: 12, color: 'var(--brand-green-text)' }} /> Saved</>
          )}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Two-column grid of text fields ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>

          {/* Clinic name */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <Building2 style={{ width: 11, height: 11 }} /> Clinic name
            </label>
            <Input
              value={draft.name}
              maxLength={80}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Hugory Veterinary Clinic"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* Tagline */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <TypeIcon style={{ width: 11, height: 11 }} /> Tagline
            </label>
            <Input
              value={draft.tagline || ''}
              maxLength={120}
              onChange={(e) => patch({ tagline: e.target.value || null })}
              placeholder="e.g. Caring for your pets since 2008"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* Phone */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <PhoneIcon style={{ width: 11, height: 11 }} /> General phone
            </label>
            <Input
              value={draft.phone || ''}
              maxLength={40}
              onChange={(e) => patch({ phone: e.target.value || null })}
              placeholder="(555) 987-6543"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* Emergency phone */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#d4183d', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <PhoneIcon style={{ width: 11, height: 11 }} /> Emergency phone
            </label>
            <Input
              value={draft.emergency_phone || ''}
              maxLength={40}
              onChange={(e) => patch({ emergency_phone: e.target.value || null })}
              placeholder="(555) 987-9999"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* Email */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <MailIcon style={{ width: 11, height: 11 }} /> Email
            </label>
            <Input
              type="email"
              value={draft.email || ''}
              maxLength={120}
              onChange={(e) => patch({ email: e.target.value || null })}
              placeholder="hello@hugoryvets.com"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* Map URL */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <MapPin style={{ width: 11, height: 11 }} /> Map URL
            </label>
            <Input
              value={draft.map_url || ''}
              maxLength={300}
              onChange={(e) => patch({ map_url: e.target.value || null })}
              placeholder="https://maps.google.com/?q=..."
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* Address */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <MapPin style={{ width: 11, height: 11 }} /> Street address
            </label>
            <Input
              value={draft.address || ''}
              maxLength={160}
              onChange={(e) => patch({ address: e.target.value || null })}
              placeholder="1420 Oak Street, Suite 200"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>

          {/* City */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <MapPin style={{ width: 11, height: 11 }} /> City, state, zip
            </label>
            <Input
              value={draft.city || ''}
              maxLength={120}
              onChange={(e) => patch({ city: e.target.value || null })}
              placeholder="Springfield, IL 62704"
              style={{ height: 34, fontSize: '13px' }}
            />
          </div>
        </div>

        {/* ── Opening hours editor ── */}
        <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px' }}>
            <ClockIcon style={{ width: 11, height: 11 }} /> Opening hours
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {draft.business_hours.map((row, i) => {
              const isClosed = !row.open || !row.close;
              return (
                <div
                  key={row.day}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 80px 1fr 1fr',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {/* Day name */}
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {row.day}
                  </span>

                  {/* Open/Closed toggle */}
                  <button
                    type="button"
                    onClick={() => toggleDayOpen(i)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isClosed ? 'color-mix(in srgb, #d4183d 30%, transparent)' : 'color-mix(in srgb, var(--brand-green-text) 30%, transparent)',
                      backgroundColor: isClosed ? 'color-mix(in srgb, #d4183d 8%, transparent)' : 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
                      color: isClosed ? '#d4183d' : 'var(--brand-green-text)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isClosed ? 'Closed' : 'Open'}
                  </button>

                  {/* Open time */}
                  <Input
                    value={row.open || ''}
                    onChange={(e) => updateHourRow(i, { open: e.target.value || null })}
                    disabled={isClosed}
                    placeholder="8:00 AM"
                    style={{ height: 30, fontSize: '12px' }}
                  />

                  {/* Close time */}
                  <Input
                    value={row.close || ''}
                    onChange={(e) => updateHourRow(i, { close: e.target.value || null })}
                    disabled={isClosed}
                    placeholder="6:00 PM"
                    style={{ height: 30, fontSize: '12px' }}
                  />
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.5 }}>
            Use a free-form time format like &ldquo;8:00 AM&rdquo; or &ldquo;5:30 PM&rdquo;. Tap &ldquo;Open&rdquo; to mark a day closed.
          </p>
        </div>
      </div>

      {/* Footer with explicit Save / Discard */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
        <Button
          variant="outline"
          onClick={handleDiscard}
          disabled={!isDirty || saving}
          style={{ gap: '6px', fontSize: '12px', height: 34 }}
        >
          <RotateCcw style={{ width: 13, height: 13 }} /> Discard
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{ gap: '6px', fontSize: '12px', height: 34, backgroundColor: ACCENT, borderColor: ACCENT, minWidth: 110 }}
        >
          {saving ? (
            <><Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> Saving</>
          ) : (
            <><Save style={{ width: 13, height: 13 }} /> Save changes</>
          )}
        </Button>
      </div>
    </section>
  );
}
