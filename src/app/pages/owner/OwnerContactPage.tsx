import { useState, useEffect } from 'react';
import {
  Phone, Mail, MapPin, Clock, Send, CheckCircle,
  MessageSquare, ChevronRight,
} from 'lucide-react';
import { useOwnerClient } from '../../hooks/useOwnerClient';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';

const BRAND = 'var(--brand-green-text)';
const BRAND_TEXT = 'var(--brand-green-text)';

interface ClinicInfo {
  name: string;
  tagline: string;
  phone: string;
  emergency: string;
  email: string;
  address: string;
  city: string;
  mapUrl: string;
}

interface HourRow {
  day: string;
  open: string | null;
  close: string | null;
}

// Fallback values used while the clinic row is loading or if nothing is set.
const CLINIC_FALLBACK: ClinicInfo = {
  name: 'Hugory Veterinary Clinic',
  tagline: 'Caring for your pets since 2008',
  phone: '(555) 987-6543',
  emergency: '(555) 987-9999',
  email: 'hello@hugoryvets.com',
  address: '1420 Oak Street, Suite 200',
  city: 'Springfield, IL 62704',
  mapUrl: 'https://maps.google.com/?q=1420+Oak+Street+Springfield+IL',
};

const HOURS_FALLBACK: HourRow[] = [
  { day: 'Monday',    open: '8:00 AM', close: '6:00 PM' },
  { day: 'Tuesday',   open: '8:00 AM', close: '6:00 PM' },
  { day: 'Wednesday', open: '8:00 AM', close: '7:00 PM' },
  { day: 'Thursday',  open: '8:00 AM', close: '6:00 PM' },
  { day: 'Friday',    open: '8:00 AM', close: '5:00 PM' },
  { day: 'Saturday',  open: '9:00 AM', close: '3:00 PM' },
  { day: 'Sunday',    open: null,       close: null },
];

// JS Date.getDay(): Sunday=0, Monday=1, ..., Saturday=6
const TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

// Color palette cycled for team member avatars
const TEAM_COLORS = ['var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261', '#06B6D4', '#10B981'];

// Display names for staff roles — keys MUST match the user_role enum values in Supabase
const ROLE_LABELS: Record<string, string> = {
  senior_veterinarian: 'Senior Veterinarian',
  veterinarian:        'Veterinarian',
  specialist:          'Specialist',
  clinic_manager:      'Clinic Manager',
  front_desk_manager:  'Front Desk Manager',
  receptionist:        'Receptionist',
};

// Priority order so vets show first, then managers, then front desk
const ROLE_PRIORITY: Record<string, number> = {
  senior_veterinarian: 1,
  veterinarian:        2,
  specialist:          3,
  clinic_manager:      4,
  front_desk_manager:  5,
  receptionist:        6,
};

interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  sortKey: number;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--surface-white)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 20px 14px', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
      </div>
      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );
}

export default function OwnerContactPage() {
  const { client: ownerClient } = useOwnerClient();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  useEffect(() => {
    if (ownerClient.fullName) {
      setForm(prev => ({ ...prev, name: ownerClient.fullName, email: ownerClient.email }));
    }
  }, [ownerClient.fullName, ownerClient.email]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // ── Live clinic info from Supabase ────────────────────────────
  // Picks the first active clinic for the owner's organization and reads
  // the editable presentation fields. Falls back to CLINIC_FALLBACK while
  // loading or if nothing is set in the database.
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>(CLINIC_FALLBACK);
  const [hours, setHours] = useState<(HourRow & { today: boolean })[]>(
    HOURS_FALLBACK.map(h => ({ ...h, today: h.day === TODAY_NAME }))
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data, error } = await supabase
          .from('clinics')
          .select('name, tagline, phone, emergency_phone, email, address, city, map_url, business_hours, is_active')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('[OwnerContactPage] clinic fetch error:', error);
          return;
        }
        if (!data) return;
        setClinicInfo({
          name: data.name || CLINIC_FALLBACK.name,
          tagline: data.tagline || CLINIC_FALLBACK.tagline,
          phone: data.phone || CLINIC_FALLBACK.phone,
          emergency: (data as any).emergency_phone || CLINIC_FALLBACK.emergency,
          email: data.email || CLINIC_FALLBACK.email,
          address: data.address || CLINIC_FALLBACK.address,
          city: data.city || CLINIC_FALLBACK.city,
          mapUrl: (data as any).map_url || CLINIC_FALLBACK.mapUrl,
        });
        const bh = (data as any).business_hours as HourRow[] | null;
        const rows = (bh && Array.isArray(bh) && bh.length > 0) ? bh : HOURS_FALLBACK;
        setHours(rows.map(h => ({ ...h, today: h.day === TODAY_NAME })));
      } catch (err) {
        console.error('[OwnerContactPage] clinic fetch exception:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch real clinic team members from Supabase.
  // Uses two queries (staff + profiles) to avoid composite-FK nested RLS issues.
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const ALLOWED_ROLES = Object.keys(ROLE_PRIORITY);
        const { data: staffRows, error: staffErr } = await supabase
          .from('staff')
          .select('id, role')
          .eq('organization_id', organizationId)
          .eq('status', 'Active')
          .in('role', ALLOWED_ROLES);
        if (staffErr) {
          console.error('[OwnerContactPage] staff query error:', staffErr);
          if (!cancelled) { setTeam([]); setTeamLoading(false); }
          return;
        }
        if (cancelled || !staffRows || staffRows.length === 0) {
          if (!cancelled) { setTeam([]); setTeamLoading(false); }
          return;
        }
        const roleById: Record<string, string> = {};
        staffRows.forEach((s: any) => { roleById[s.id] = s.role; });
        const ids = staffRows.map((s: any) => s.id);
        const { data: profileRows, error: profErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', ids);
        if (profErr) {
          console.error('[OwnerContactPage] profiles query error:', profErr);
          if (!cancelled) { setTeam([]); setTeamLoading(false); }
          return;
        }
        if (cancelled || !profileRows) return;
        const list: TeamMember[] = profileRows.map((p: any, idx: number) => {
          const fn = p.first_name || '';
          const ln = p.last_name || '';
          const role = roleById[p.id] || '';
          const isVet = role === 'veterinarian' || role === 'senior_veterinarian' || role === 'specialist';
          const display = isVet
            ? (ln ? `Dr. ${ln}` : (fn ? `Dr. ${fn}` : 'Vet'))
            : [fn, ln].filter(Boolean).join(' ') || 'Team Member';
          const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'TM';
          return {
            id: p.id,
            name: display,
            role: ROLE_LABELS[role] || 'Team Member',
            initials,
            color: TEAM_COLORS[idx % TEAM_COLORS.length],
            sortKey: ROLE_PRIORITY[role] || 99,
          };
        });
        list.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
        if (!cancelled) { setTeam(list); setTeamLoading(false); }
      } catch (err) {
        console.error('[OwnerContactPage] team fetch exception:', err);
        if (!cancelled) { setTeam([]); setTeamLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 1400);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }} className="p-4 md:p-8">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Contact Clinic
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Get in touch with {clinicInfo.name}
          </p>
        </div>

        {/* ── Hero banner ── */}
        <Card style={{ marginBottom: '24px', borderTop: `4px solid ${BRAND}`, overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3px' }}>{clinicInfo.name}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{clinicInfo.tagline}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href={`tel:${clinicInfo.phone.replace(/\D/g, '')}`}
                style={{
                  padding: '9px 18px', borderRadius: '9px',
                  backgroundColor: BRAND, color: '#fff',
                  fontSize: '13px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  textDecoration: 'none',
                }}
              >
                <Phone style={{ width: '14px', height: '14px' }} /> Call Now
              </a>
              <a
                href={`mailto:${clinicInfo.email}`}
                style={{
                  padding: '9px 18px', borderRadius: '9px',
                  backgroundColor: 'transparent', color: BRAND_TEXT,
                  border: `1.5px solid ${BRAND}`,
                  fontSize: '13px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  textDecoration: 'none',
                }}
              >
                <Mail style={{ width: '14px', height: '14px' }} /> Email Us
              </a>
            </div>
          </div>
        </Card>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Contact info tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Phone */}
              <Card style={{ padding: '18px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <Phone style={{ width: '18px', height: '18px', color: BRAND_TEXT }} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Phone</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{clinicInfo.phone}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>General enquiries</p>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#d4183d', marginBottom: '2px' }}>Emergency</p>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#d4183d' }}>{clinicInfo.emergency}</p>
                </div>
              </Card>

              {/* Email */}
              <Card style={{ padding: '18px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#3B82F615', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <Mail style={{ width: '18px', height: '18px', color: '#3B82F6' }} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Email</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px', wordBreak: 'break-all' }}>{clinicInfo.email}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Replies within 24 h</p>
              </Card>

              {/* Address */}
              <Card style={{ padding: '18px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#F59E0B15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <MapPin style={{ width: '18px', height: '18px', color: '#D97706' }} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Address</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{clinicInfo.address}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{clinicInfo.city}</p>
                <a
                  href={clinicInfo.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', fontWeight: 600, color: BRAND_TEXT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  Get directions <ChevronRight style={{ width: '12px', height: '12px' }} />
                </a>
              </Card>
            </div>

            {/* Message form */}
            <Card>
              <SectionTitle icon={MessageSquare} title="Send a Message" />
              <div style={{ padding: '20px' }}>
                {sent ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '40px 20px', gap: '12px',
                  }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle style={{ width: '26px', height: '26px', color: BRAND_TEXT }} />
                    </div>
                    <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Message Sent!</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '320px' }}>
                      Our reception team will get back to you within 24 hours. You can also call us directly for urgent matters.
                    </p>
                    <button
                      onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '' })); }}
                      style={{ marginTop: '8px', padding: '9px 20px', borderRadius: '9px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', color: BRAND_TEXT, border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Send Another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Name + Email row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Your Name</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--surface-elevated)',
                            color: 'var(--text-primary)', fontSize: '14px',
                            outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Your Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--surface-elevated)',
                            color: 'var(--text-primary)', fontSize: '14px',
                            outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Subject</label>
                      <input
                        type="text"
                        placeholder="e.g. Appointment question, prescription refill…"
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        required
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--surface-elevated)',
                          color: 'var(--text-primary)', fontSize: '14px',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Message</label>
                      <textarea
                        placeholder="Write your message here…"
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        required
                        rows={5}
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--surface-elevated)',
                          color: 'var(--text-primary)', fontSize: '14px',
                          outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '10px 24px', borderRadius: '9px',
                        backgroundColor: sending ? 'color-mix(in srgb, var(--brand-green-text) 50%, transparent)' : BRAND,
                        color: '#fff', border: 'none',
                        fontSize: '14px', fontWeight: 700,
                        cursor: sending ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '7px',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <Send style={{ width: '14px', height: '14px' }} />
                      {sending ? 'Sending…' : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </Card>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Work hours */}
            <Card>
              <SectionTitle icon={Clock} title="Opening Hours" />
              <div style={{ padding: '14px 20px' }}>
                {hours.map(h => (
                  <div
                    key={h.day}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
                      backgroundColor: h.today ? 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {h.today && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: BRAND, flexShrink: 0, display: 'inline-block' }} />
                      )}
                      <span style={{
                        fontSize: '13px',
                        fontWeight: h.today ? 700 : 500,
                        color: h.today ? BRAND_TEXT : 'var(--text-primary)',
                        marginLeft: h.today ? 0 : '14px',
                      }}>
                        {h.day}{h.today && <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '6px', opacity: 0.7 }}>TODAY</span>}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: h.today ? 700 : 400,
                      color: h.open ? (h.today ? BRAND_TEXT : 'var(--text-primary)') : 'var(--text-secondary)',
                    }}>
                      {h.open ? `${h.open} – ${h.close}` : 'Closed'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Team */}
            <Card>
              <SectionTitle icon={MessageSquare} title="Our Team" />
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {teamLoading ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Loading clinic team…</p>
                ) : team.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No team members available.</p>
                ) : team.map(member => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${member.color}, color-mix(in srgb, ${member.color} 73%, transparent))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#fff', fontSize: '12px', fontWeight: 700,
                    }}>
                      {member.initials}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{member.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
