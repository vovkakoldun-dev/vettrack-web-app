import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, X, Edit2, Mail, Phone, MapPin, Calendar,
  Briefcase, Award, Shield, ChevronDown, ChevronRight,
  MoreHorizontal, Download, UserCheck, UserX, MessageSquare,
  Star, Clock, Building2, Users, UserPlus, AlertCircle, Loader2, TreePalm, ThermometerSun,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { supabase } from '../../../lib/supabase';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';

// ─── Theme ────────────────────────────────────────────────────
const ACCENT   = '#F4A261';
const ACCENT_D = '#C2671A';
const ACCENT_BG = '#F4A26112';

// ─── Types ────────────────────────────────────────────────────
type Role = 'Senior Veterinarian' | 'Veterinarian' | 'Vet Technician' | 'Lead Vet Tech'
  | 'Receptionist' | 'Front Desk Manager' | 'Clinic Manager' | 'Groomer' | 'Lab Technician' | 'Specialist'
  | 'Super Administrator' | 'Owner';

type Department = 'Clinical' | 'Front Desk' | 'Management' | 'Support' | 'Lab';

type StaffStatus = 'Active' | 'On Leave' | 'Inactive' | 'Probation';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  department: Department;
  clinic: string;
  email: string;
  phone: string;
  status: StaffStatus;
  initials: string;
  avatarColor: string;
  photoUrl?: string;
  startDate: string;
  licenseNo?: string;
  schedule: string;
  specializations?: string[];
  bio: string;
  emergencyContact: string;
  notes?: string;
  appointments?: number;
  rating?: number;
  ptoAllowance: number;
  sickAllowance: number;
}

// ─── Config ───────────────────────────────────────────────────
const ROLE_CONFIG: Record<Role, { color: string; bg: string }> = {
  'Senior Veterinarian': { color: '#16A34A', bg: '#22C55E15' },
  'Veterinarian':        { color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' },
  'Vet Technician':      { color: '#2563EB', bg: '#3B82F615' },
  'Lead Vet Tech':       { color: '#1D4ED8', bg: '#3B82F620' },
  'Receptionist':        { color: '#7C3AED', bg: '#8B5CF615' },
  'Front Desk Manager':  { color: '#6D28D9', bg: '#8B5CF620' },
  'Clinic Manager':      { color: ACCENT_D,  bg: ACCENT_BG  },
  'Groomer':             { color: '#BE185D', bg: '#EC489915' },
  'Lab Technician':      { color: '#0E7490', bg: '#06B6D415' },
  'Specialist':          { color: '#374151', bg: '#6B728015' },
  'Super Administrator': { color: '#F4A261', bg: '#F4A26115' },
  'Owner':               { color: '#92400E', bg: '#F59E0B15' },
};

const STATUS_CONFIG: Record<StaffStatus, { color: string; bg: string; dot: string }> = {
  Active:    { color: '#16A34A', bg: '#22C55E15', dot: '#22C55E' },
  'On Leave':{ color: '#D97706', bg: '#F59E0B15', dot: '#FBBF24' },
  Inactive:  { color: '#6B7280', bg: '#6B728015', dot: '#9CA3AF' },
  Probation: { color: '#DC2626', bg: '#EF444415', dot: '#F87171' },
};

const DEPT_TABS = ['All', 'Veterinarians', 'Vet Techs', 'Front Desk', 'Management', 'Lab & Support'] as const;
type DeptTab = typeof DEPT_TABS[number];

// CLINICS filter is now dynamically populated — see clinicNames state

// ─── DB → UI role mapping ────────────────────────────────────
const DB_ROLE_TO_UI: Record<string, Role> = {
  veterinarian: 'Veterinarian',
  senior_veterinarian: 'Senior Veterinarian',
  specialist: 'Specialist',
  vet_technician: 'Vet Technician',
  lead_vet_tech: 'Lead Vet Tech',
  receptionist: 'Receptionist',
  front_desk_manager: 'Front Desk Manager',
  clinic_manager: 'Clinic Manager',
  groomer: 'Groomer',
  lab_technician: 'Lab Technician',
  superadmin: 'Super Administrator',
  owner: 'Owner',
};
const UI_ROLE_TO_DB: Record<Role, string> = Object.fromEntries(
  Object.entries(DB_ROLE_TO_UI).map(([k, v]) => [v, k])
) as Record<Role, string>;

const AVATAR_COLORS = ['var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261', '#06B6D4', '#6366F1', '#DC2626', '#0EA5E9', '#14B8A6'];

function roleToDept(role: Role): Department {
  if (['Veterinarian', 'Senior Veterinarian', 'Specialist'].includes(role)) return 'Clinical';
  if (['Vet Technician', 'Lead Vet Tech'].includes(role)) return 'Clinical';
  if (['Receptionist', 'Front Desk Manager'].includes(role)) return 'Front Desk';
  if (['Clinic Manager', 'Super Administrator', 'Owner'].includes(role)) return 'Management';
  if (role === 'Lab Technician') return 'Lab';
  if (role === 'Groomer') return 'Support';
  return 'Clinical';
}

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tenure(iso: string) {
  const start = new Date(iso + 'T00:00:00');
  const now   = new Date('2026-03-15');
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (months < 12) return `${months}mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo ? `${yr}y ${mo}mo` : `${yr}y`;
}

function tabMatch(s: StaffMember, tab: DeptTab): boolean {
  if (tab === 'All') return true;
  if (tab === 'Veterinarians') return s.role === 'Veterinarian' || s.role === 'Senior Veterinarian' || s.role === 'Specialist';
  if (tab === 'Vet Techs')     return s.role === 'Vet Technician' || s.role === 'Lead Vet Tech';
  if (tab === 'Front Desk')    return s.role === 'Receptionist' || s.role === 'Front Desk Manager';
  if (tab === 'Management')    return s.role === 'Clinic Manager' || s.role === 'Super Administrator' || s.role === 'Owner';
  if (tab === 'Lab & Support') return s.role === 'Lab Technician' || s.role === 'Groomer';
  return true;
}

// ─── Subcomponents ────────────────────────────────────────────
function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      color: cfg.color, backgroundColor: cfg.bg,
      whiteSpace: 'nowrap',
    }}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: StaffStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function AvatarCircle({ initials, color, size = 36, photoUrl }: { initials: string; color: string; size?: number; photoUrl?: string }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          objectFit: 'cover',
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.33, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Star style={{ width: 12, height: 12, fill: ACCENT, color: ACCENT }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT_D }}>{rating.toFixed(1)}</span>
    </span>
  );
}

// ─── Staff Detail Drawer ──────────────────────────────────────
function StaffDetailDrawer({
  staff, onClose, onEdit, onToggleStatus,
}: {
  staff: StaffMember;
  onClose: () => void;
  onEdit: (s: StaffMember) => void;
  onToggleStatus: (id: string) => void;
}) {
  const roleCfg   = ROLE_CONFIG[staff.role];
  const statusCfg = STATUS_CONFIG[staff.status];
  const isActive  = staff.status === 'Active' || staff.status === 'Probation';

  // Fetch PTO/sick usage from staff_time_blocks
  const [ptoUsed, setPtoUsed] = useState(0);
  const [sickUsed, setSickUsed] = useState(0);
  const [ptoPending, setPtoPending] = useState(0);
  const [sickPending, setSickPending] = useState(0);
  useEffect(() => {
    (async () => {
      const { organizationId } = await getOrgContext();
      const { data } = await db
        .from('staff_time_blocks')
        .select('type, status')
        .eq('organization_id', organizationId)
        .eq('staff_id', staff.id);
      if (data) {
        setPtoUsed(data.filter((b: any) => b.type === 'PTO' && (b.status === 'Approved' || b.status === 'Confirmed')).length);
        setSickUsed(data.filter((b: any) => b.type === 'Sick Day' && (b.status === 'Approved' || b.status === 'Confirmed')).length);
        setPtoPending(data.filter((b: any) => b.type === 'PTO' && b.status === 'Pending').length);
        setSickPending(data.filter((b: any) => b.type === 'Sick Day' && b.status === 'Pending').length);
      }
    })();
  }, [staff.id]);

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 460, backgroundColor: 'var(--surface-white)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Staff Profile</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onEdit(staff)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${ACCENT}`,
                backgroundColor: ACCENT_BG, color: ACCENT_D, fontWeight: 700, fontSize: 13,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Edit2 style={{ width: 13, height: 13 }} /> Edit
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)',
                backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Avatar + Name */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
            <AvatarCircle initials={staff.initials} color={staff.avatarColor} size={72} photoUrl={staff.photoUrl} />
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                {staff.firstName} {staff.lastName}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <RoleBadge role={staff.role} />
                <StatusBadge status={staff.status} />
                {staff.rating != null && <StarRating rating={staff.rating} />}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <Building2 style={{ width: 11, height: 11, display: 'inline', marginRight: 4 }} />
                {staff.clinic}
              </span>
            </div>
          </div>

          {/* Contact */}
          <div style={{
            backgroundColor: 'var(--surface-elevated)', borderRadius: 12, padding: '16px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', margin: '0 0 12px' }}>Contact</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: Mail, label: staff.email },
                { icon: Phone, label: staff.phone },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 14, height: 14, color: ACCENT_D }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Employment Details */}
          <div style={{
            backgroundColor: 'var(--surface-elevated)', borderRadius: 12, padding: '16px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', margin: '0 0 12px' }}>Employment</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {[
                { label: 'Department',  value: staff.department },
                { label: 'Start Date',  value: fmtDate(staff.startDate) },
                { label: 'Tenure',      value: tenure(staff.startDate) },
                { label: 'Schedule',    value: staff.schedule },
                ...(staff.licenseNo ? [{ label: 'License #', value: staff.licenseNo }] : []),
                ...(staff.appointments != null && staff.appointments > 0 ? [{ label: 'Total Appts', value: staff.appointments.toLocaleString() }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 2px' }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Specializations */}
          {staff.specializations && staff.specializations.length > 0 && (
            <div style={{
              backgroundColor: 'var(--surface-elevated)', borderRadius: 12, padding: '16px',
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                <Award style={{ width: 11, height: 11, display: 'inline', marginRight: 4 }} />
                Specializations
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {staff.specializations.map(s => (
                  <span key={s} style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    backgroundColor: ACCENT_BG, color: ACCENT_D, border: `1px solid ${ACCENT}40`,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          <div style={{
            backgroundColor: 'var(--surface-elevated)', borderRadius: 12, padding: '16px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', margin: '0 0 8px' }}>About</p>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>{staff.bio}</p>
          </div>

          {/* Emergency Contact */}
          <div style={{
            backgroundColor: '#EF444408', borderRadius: 12, padding: '14px 16px',
            border: '1px solid #EF444420', marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#DC2626', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle style={{ width: 11, height: 11 }} /> Emergency Contact
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{staff.emergencyContact}</p>
          </div>

          {/* Time Off */}
          <div style={{
            backgroundColor: 'var(--surface-elevated)', borderRadius: 12, padding: '16px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', margin: '0 0 12px' }}>Time Off</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* PTO */}
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TreePalm style={{ width: 14, height: 14, color: '#1D4ED8' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>PTO</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {staff.ptoAllowance - ptoUsed} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>/ {staff.ptoAllowance} days left</span>
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, backgroundColor: 'var(--border-color)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: '#3B82F6', borderRadius: 9999, width: `${staff.ptoAllowance > 0 ? (ptoUsed / staff.ptoAllowance) * 100 : 0}%`, transition: 'width 0.3s' }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  {ptoUsed} used{ptoPending > 0 ? ` · ${ptoPending} pending` : ' · none pending'}
                </p>
              </div>
              {/* Sick Days */}
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ThermometerSun style={{ width: 14, height: 14, color: '#d4183d' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Sick Days</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {staff.sickAllowance - sickUsed} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>/ {staff.sickAllowance} days left</span>
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, backgroundColor: 'var(--border-color)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: '#d4183d', borderRadius: 9999, width: `${staff.sickAllowance > 0 ? (sickUsed / staff.sickAllowance) * 100 : 0}%`, transition: 'width 0.3s' }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  {sickUsed} used{sickPending > 0 ? ` · ${sickPending} pending` : ' · none pending'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {staff.notes && (
            <div style={{
              backgroundColor: 'var(--surface-elevated)', borderRadius: 12, padding: '14px 16px',
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Notes</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{staff.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          borderTop: '1px solid var(--border-color)', padding: '16px 24px',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              backgroundColor: ACCENT, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onClick={() => onEdit(staff)}
          >
            <Edit2 style={{ width: 14, height: 14 }} /> Edit Profile
          </button>
          <button
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              backgroundColor: isActive ? '#EF444410' : '#22C55E10',
              color: isActive ? '#DC2626' : '#16A34A',
              border: `1px solid ${isActive ? '#EF444430' : '#22C55E30'}`,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onClick={() => onToggleStatus(staff.id)}
          >
            {isActive
              ? <><UserX style={{ width: 14, height: 14 }} /> Deactivate</>
              : <><UserCheck style={{ width: 14, height: 14 }} /> Activate</>
            }
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Add / Edit Drawer ────────────────────────────────────────
const ROLES: Role[] = ['Senior Veterinarian', 'Veterinarian', 'Vet Technician', 'Lead Vet Tech', 'Receptionist', 'Front Desk Manager', 'Clinic Manager', 'Super Administrator', 'Owner', 'Groomer', 'Lab Technician', 'Specialist']
const DEPTS: Department[] = ['Clinical', 'Front Desk', 'Management', 'Support', 'Lab'];
// CLINIC_NAMES is now dynamically populated from Supabase — see clinicNames state
const STATUS_LIST: StaffStatus[] = ['Active', 'Probation', 'On Leave', 'Inactive'];

type Portal = 'doctor' | 'admin';

type FormState = {
  firstName: string; lastName: string; role: Role; department: Department;
  clinic: string; email: string; phone: string; status: StaffStatus;
  startDate: string; licenseNo: string; schedule: string; bio: string; emergencyContact: string; notes: string;
  portal: Portal; tempPassword: string;
  ptoAllowance: string; sickAllowance: string;
};

const EMPTY_FORM: FormState = {
  firstName: '', lastName: '', role: 'Veterinarian', department: 'Clinical',
  clinic: '', email: '', phone: '', status: 'Active',
  startDate: '', licenseNo: '', schedule: 'Mon–Fri, 9–6', bio: '', emergencyContact: '', notes: '',
  portal: 'doctor', tempPassword: '',
  ptoAllowance: '20', sickAllowance: '10',
};

function StaffFormDrawer({
  initial, onClose, onSave, availableClinics,
}: {
  initial?: StaffMember | null;
  onClose: () => void;
  onSave: (f: FormState, isEdit: boolean) => void;
  availableClinics: string[];
}) {
  const [form, setForm] = useState<FormState>(initial ? {
    firstName: initial.firstName, lastName: initial.lastName, role: initial.role,
    department: initial.department, clinic: initial.clinic, email: initial.email,
    phone: initial.phone, status: initial.status, startDate: initial.startDate,
    licenseNo: initial.licenseNo ?? '', schedule: initial.schedule, bio: initial.bio,
    emergencyContact: initial.emergencyContact, notes: initial.notes ?? '',
    portal: 'doctor', tempPassword: '',
    ptoAllowance: String(initial.ptoAllowance ?? 20), sickAllowance: String(initial.sickAllowance ?? 10),
  } : { ...EMPTY_FORM, clinic: availableClinics[0] || '' });

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim() && (!!initial || form.tempPassword.length >= 6);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 500, backgroundColor: 'var(--surface-white)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {initial ? 'Edit Staff Member' : 'Add New Staff'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {initial ? `Editing ${initial.firstName} ${initial.lastName}` : 'Fill in the details below'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Name row */}
          <p style={labelStyle}>Name <span style={{ color: '#EF4444' }}>*</span></p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Input placeholder="First name" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            <Input placeholder="Last name"  value={form.lastName}  onChange={e => set('lastName', e.target.value)} />
          </div>

          {/* Role + Dept */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <p style={labelStyle}>Role</p>
              <Select value={form.role} onValueChange={v => set('role', v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <p style={labelStyle}>Department</p>
              <Select value={form.department} onValueChange={v => set('department', v as Department)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Clinic + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <p style={labelStyle}>Clinic</p>
              <Select value={form.clinic} onValueChange={v => set('clinic', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{availableClinics.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <p style={labelStyle}>Status</p>
              <Select value={form.status} onValueChange={v => set('status', v as StaffStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Email + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <p style={labelStyle}>Email <span style={{ color: '#EF4444' }}>*</span></p>
              <Input placeholder="email@hugory.vet" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <p style={labelStyle}>Phone</p>
              <Input placeholder="(555) 000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>

          {/* Start Date + Schedule */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <p style={labelStyle}>Start Date</p>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <p style={labelStyle}>Schedule</p>
              <Input placeholder="Mon–Fri, 9–6" value={form.schedule} onChange={e => set('schedule', e.target.value)} />
            </div>
          </div>

          {/* License No */}
          <div style={{ marginBottom: 16 }}>
            <p style={labelStyle}>License # <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></p>
            <Input placeholder="DVM-CA-00000" value={form.licenseNo} onChange={e => set('licenseNo', e.target.value)} />
          </div>

          {/* Emergency Contact */}
          <div style={{ marginBottom: 16 }}>
            <p style={labelStyle}>Emergency Contact</p>
            <Input placeholder="Name — (555) 000-0000" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} />
          </div>

          {/* Time Off Allowance */}
          <div style={{ marginTop: 8, marginBottom: 4, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Time Off Allowance</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <p style={labelStyle}><TreePalm style={{ width: 13, height: 13, display: 'inline', verticalAlign: -2, marginRight: 4, color: '#1D4ED8' }} />PTO Days / Year</p>
              <Input type="number" min="0" value={form.ptoAllowance} onChange={e => set('ptoAllowance', e.target.value)} />
            </div>
            <div>
              <p style={labelStyle}><ThermometerSun style={{ width: 13, height: 13, display: 'inline', verticalAlign: -2, marginRight: 4, color: '#d4183d' }} />Sick Days / Year</p>
              <Input type="number" min="0" value={form.sickAllowance} onChange={e => set('sickAllowance', e.target.value)} />
            </div>
          </div>

          {/* Portal + Temporary Password */}
          {!initial && (
            <>
              <div style={{ marginTop: 8, marginBottom: 4, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Portal Access</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <p style={labelStyle}>Portal <span style={{ color: '#EF4444' }}>*</span></p>
                  <Select value={form.portal} onValueChange={v => set('portal', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Veterinary</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p style={labelStyle}>Temporary Password <span style={{ color: '#EF4444' }}>*</span></p>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    value={form.tempPassword}
                    onChange={e => set('tempPassword', e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '-8px 0 8px', lineHeight: 1.4 }}>
                The user will log in with their email and this temporary password. They can change it later in Settings.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => valid && onSave(form, !!initial)}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
              backgroundColor: valid ? ACCENT : 'var(--border-color)',
              color: valid ? '#fff' : 'var(--text-secondary)',
              fontSize: 14, fontWeight: 700, cursor: valid ? 'pointer' : 'default',
            }}
          >
            {initial ? 'Save Changes' : 'Add Staff Member'}
          </button>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
  margin: '0 0 6px',
};

// ─── Main Page ────────────────────────────────────────────────
export default function SuperAdminStaffPage() {
  const db = useTenantDb();
  const [staff, setStaff]               = useState<StaffMember[]>([]);
  const [loading, setLoading]           = useState(true);
  const [clinicNames, setClinicNames]   = useState<string[]>([]);
  const [clinicMap, setClinicMap]       = useState<Record<string, string>>({}); // clinic_id → name
  const [search, setSearch]             = useState('');
  const [tab, setTab]                   = useState<DeptTab>('All');
  const [clinicFilter, setClinicFilter] = useState('All Clinics');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'All'>('All');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editStaff, setEditStaff]       = useState<StaffMember | null | undefined>(undefined); // undefined = closed
  const [addOpen, setAddOpen]           = useState(false);
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Fetch clinics ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db.from('clinics').select('id, name').eq('organization_id', organizationId);
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((c: any) => { map[c.id] = c.name; });
          setClinicMap(map);
          setClinicNames(data.map((c: any) => c.name));
        }
      } catch {}
    })();
  }, []);

  // ── Fetch staff from Supabase ──────────────────────────────
  const fetchStaff = useCallback(async () => {
    const { organizationId } = await getOrgContext();
    const { data, error } = await db
      .from('staff')
      .select('*, profiles:profiles!staff_profile_id_fkey(first_name, last_name, email, phone, avatar_url)')
      .eq('organization_id', organizationId)
      .order('first_name');

    if (error || !data) { setLoading(false); return; }

    const mapped: StaffMember[] = data.map((row: any, idx: number) => {
      const uiRole = DB_ROLE_TO_UI[row.role] || 'Veterinarian';
      // Identity from profiles (source of truth), fallback to staff columns
      const firstName = row.profiles?.first_name || row.first_name || '';
      const lastName = row.profiles?.last_name || row.last_name || '';
      const profileAvatarUrl = row.profiles?.avatar_url || null;
      const photoUrl = row.photo_url || profileAvatarUrl || undefined;
      return {
        id: row.id,
        firstName,
        lastName,
        role: uiRole,
        department: row.department || roleToDept(uiRole),
        clinic: clinicMap[row.clinic_id] || 'Unknown Clinic',
        email: row.profiles?.email || row.email || '',
        phone: row.profiles?.phone || row.phone || '',
        status: (['Active', 'On Leave', 'Inactive', 'Probation'].includes(row.status) ? row.status : 'Active') as StaffStatus,
        initials: (firstName[0] || '') + (lastName[0] || ''),
        avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        photoUrl,
        startDate: row.created_at ? row.created_at.split('T')[0] : '2026-01-01',
        licenseNo: row.license_no || undefined,
        schedule: row.schedule || 'Mon–Fri, 9–6',
        bio: row.bio || '',
        emergencyContact: '',
        specializations: undefined,
        appointments: undefined,
        rating: undefined,
        ptoAllowance: row.pto_allowance ?? 20,
        sickAllowance: row.sick_allowance ?? 10,
      };
    });
    setStaff(mapped);
    setLoading(false);
  }, [clinicMap]);

  useEffect(() => {
    if (Object.keys(clinicMap).length > 0) fetchStaff();
    // Also load if clinicMap is empty (no clinics yet) after a delay
    const t = setTimeout(() => { if (Object.keys(clinicMap).length === 0) fetchStaff(); }, 500);
    return () => clearTimeout(t);
  }, [clinicMap, fetchStaff]);

  // Close row menu on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Derived ────────────────────────────────────────────────
  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${s.firstName} ${s.lastName} ${s.role} ${s.clinic} ${s.email}`.toLowerCase().includes(q);
    const matchClinic = clinicFilter === 'All Clinics' || s.clinic === clinicFilter;
    const matchStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchSearch && matchClinic && matchStatus && tabMatch(s, tab);
  });

  const tabCounts = DEPT_TABS.reduce((acc, t) => {
    acc[t] = staff.filter(s => tabMatch(s, t)).length;
    return acc;
  }, {} as Record<DeptTab, number>);

  const totalActive   = staff.filter(s => s.status === 'Active').length;
  const totalOnLeave  = staff.filter(s => s.status === 'On Leave').length;
  const totalInactive = staff.filter(s => s.status === 'Inactive' || s.status === 'Probation').length;
  const newThisMonth  = staff.filter(s => s.startDate >= '2026-03-01').length;

  // ── Handlers ───────────────────────────────────────────────
  const handleToggleStatus = async (id: string) => {
    const current = staff.find(s => s.id === id);
    if (!current) return;
    const next: StaffStatus = (current.status === 'Active' || current.status === 'Probation') ? 'Inactive' : 'Active';
    const { organizationId } = await getOrgContext();
    await db.from('staff').update({ status: next }).eq('id', id).eq('organization_id', organizationId);
    setStaff(prev => prev.map(s => s.id !== id ? s : { ...s, status: next }));
    setSelectedStaff(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, status: next };
    });
  };

  const handleSave = async (form: FormState, isEdit: boolean) => {
    try {
    // Reverse-lookup clinic_id from clinic name
    const clinicId = Object.entries(clinicMap).find(([, name]) => name === form.clinic)?.[0] || null;
    const dbRole = UI_ROLE_TO_DB[form.role] || 'veterinarian';

    const dbPayload: Record<string, any> = {
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone || null,
      role: dbRole,
      department: form.department,
      status: form.status,
      clinic_id: clinicId,
      schedule: form.schedule || null,
      license_no: form.licenseNo || null,
      bio: form.bio || null,
      pto_allowance: parseInt(form.ptoAllowance) || 20,
      sick_allowance: parseInt(form.sickAllowance) || 10,
    };

    if (isEdit && editStaff) {
      const { organizationId: orgId } = await getOrgContext();
      await db.from('staff').update(dbPayload).eq('id', editStaff.id).eq('organization_id', orgId);
      // Also update profiles table for name/email/phone
      await db.from('profiles').update({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phone || null,
        role: dbRole,
      }).eq('id', editStaff.id);
    } else {
      const orgCtx = await getOrgContext();

      // Save current session before creating new user
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // Create Supabase Auth user with metadata — the DB trigger creates profile + staff rows automatically
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.tempPassword,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            role: dbRole,
            organization_id: orgCtx.organizationId,
            clinic_id: clinicId || '00000000-0000-0000-0000-000000000002',
            department: form.department,
          },
        },
      });
      if (authErr || !authData.user) {
        alert('Failed to create user account: ' + (authErr?.message || 'Unknown error'));
        return;
      }
      const userId = authData.user.id;

      // Restore the superadmin session (signUp may have switched it)
      if (currentSession) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        });
      }

      // Update the staff record with additional fields the trigger didn't set
      await db.from('staff').update({
        phone: form.phone || null,
        schedule: form.schedule || null,
        license_no: form.licenseNo || null,
      }).eq('id', userId).eq('organization_id', orgCtx.organizationId);
    }

    setEditStaff(undefined);
    setAddOpen(false);
    fetchStaff(); // Refresh from DB
    } catch (e: any) {
      console.error('handleSave error:', e);
      alert('Error saving staff: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    const { organizationId } = await getOrgContext();
    await db.from('staff').delete().eq('id', id).eq('organization_id', organizationId);
    setStaff(prev => prev.filter(s => s.id !== id));
    if (selectedStaff?.id === id) setSelectedStaff(null);
    setOpenMenuId(null);
  };

  // ── Stat cards ─────────────────────────────────────────────
  const STATS = [
    { label: 'Total Staff',     value: staff.length, icon: Users,     color: ACCENT,     bgColor: ACCENT_BG,   sub: 'across all clinics' },
    { label: 'Active',          value: totalActive,  icon: UserCheck,  color: '#16A34A',  bgColor: '#22C55E15', sub: staff.length > 0 ? `${Math.round(totalActive / staff.length * 100)}% of total` : '0% of total' },
    { label: 'On Leave',        value: totalOnLeave, icon: Clock,      color: '#D97706',  bgColor: '#F59E0B15', sub: 'currently away' },
    { label: 'New This Month',  value: newThisMonth, icon: UserPlus,   color: '#6366F1',  bgColor: '#818CF815', sub: 'onboarded Mar 2026' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', padding: '32px 32px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Staff</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
              Manage staff members across all clinic locations
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Download style={{ width: 14, height: 14 }} /> Export
            </Button>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                borderRadius: 10, border: 'none', backgroundColor: ACCENT,
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              <Plus style={{ width: 16, height: 16 }} /> Add Staff
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {STATS.map(s => (
            <div key={s.label} style={{
              backgroundColor: 'var(--surface-white)', borderRadius: 16, padding: '20px',
              border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: s.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon style={{ width: 20, height: 20, color: s.color }} />
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{s.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Card ── */}
        <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: 20, border: '1px solid var(--border-color)', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
              <Input
                placeholder="Search staff by name, role, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, height: 38 }}
              />
            </div>

            <Select value={clinicFilter} onValueChange={setClinicFilter}>
              <SelectTrigger style={{ width: 200, height: 38 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All Clinics">All Clinics</SelectItem>
                {clinicNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StaffStatus | 'All')}>
              <SelectTrigger style={{ width: 140, height: 38 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                {STATUS_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Role tabs */}
          <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 4, overflowX: 'auto' }}>
            {DEPT_TABS.map(t => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '12px 14px', border: 'none', cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap',
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? ACCENT_D : 'var(--text-secondary)',
                    borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {t}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                    backgroundColor: active ? ACCENT_BG : 'var(--surface-elevated)',
                    color: active ? ACCENT_D : 'var(--text-secondary)',
                  }}>{tabCounts[t]}</span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  {['Staff Member', 'Role', 'Clinic', 'Status', 'Schedule', 'Start Date', ''].map(h => (
                    <th key={h} style={{
                      padding: h === '' ? '12px 16px' : '12px 16px',
                      textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                        Loading staff…
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      No staff members match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedStaff(s)}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                      cursor: 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Staff Member */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AvatarCircle initials={s.initials} color={s.avatarColor} size={38} photoUrl={s.photoUrl} />
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1px' }}>
                            {s.firstName} {s.lastName}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{s.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <RoleBadge role={s.role} />
                    </td>

                    {/* Clinic */}
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>{s.clinic}</p>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={s.status} />
                    </td>

                    {/* Schedule */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.schedule}</span>
                    </td>

                    {/* Start Date */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 1px' }}>{fmtDate(s.startDate)}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{tenure(s.startDate)} tenure</p>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }} ref={openMenuId === s.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenuId(prev => prev === s.id ? null : s.id)}
                          style={{
                            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <MoreHorizontal style={{ width: 16, height: 16 }} />
                        </button>

                        {openMenuId === s.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '110%', zIndex: 20,
                            backgroundColor: 'var(--surface-white)', borderRadius: 10,
                            border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            minWidth: 160, overflow: 'hidden',
                          }}>
                            {[
                              { label: 'View Profile',  icon: ChevronRight, onClick: () => { setSelectedStaff(s); setOpenMenuId(null); } },
                              { label: 'Edit',          icon: Edit2,        onClick: () => { setEditStaff(s); setOpenMenuId(null); } },
                              { label: s.status === 'Inactive' ? 'Activate' : 'Deactivate', icon: s.status === 'Inactive' ? UserCheck : UserX, onClick: () => { handleToggleStatus(s.id); setOpenMenuId(null); } },
                            ].map(item => (
                              <button
                                key={item.label}
                                onClick={item.onClick}
                                style={{
                                  width: '100%', padding: '9px 14px', textAlign: 'left', border: 'none',
                                  backgroundColor: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <item.icon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
                                {item.label}
                              </button>
                            ))}
                            <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                            <button
                              onClick={() => handleDelete(s.id)}
                              style={{
                                width: '100%', padding: '9px 14px', textAlign: 'left', border: 'none',
                                backgroundColor: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                                color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EF444410')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <X style={{ width: 14, height: 14 }} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{staff.length}</strong> staff members
            </span>
            <div style={{ display: 'flex', gap: 16 }}>
              {Object.entries(
                filtered.reduce((acc, s) => { acc[s.clinic] = (acc[s.clinic] ?? 0) + 1; return acc; }, {} as Record<string, number>)
              ).map(([clinic, count]) => (
                <span key={clinic} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {clinic}: <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      {selectedStaff && (
        <StaffDetailDrawer
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onEdit={s => { setEditStaff(s); setSelectedStaff(null); }}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* ── Add Drawer ── */}
      {addOpen && (
        <StaffFormDrawer onClose={() => setAddOpen(false)} onSave={handleSave} availableClinics={clinicNames} />
      )}

      {/* ── Edit Drawer ── */}
      {editStaff !== undefined && !addOpen && (
        <StaffFormDrawer
          initial={editStaff}
          onClose={() => setEditStaff(undefined)}
          onSave={handleSave}
          availableClinics={clinicNames}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
