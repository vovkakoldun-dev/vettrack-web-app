import { useState } from 'react';
import {
  Phone, Mail, MapPin, Clock, Send, CheckCircle,
  MessageSquare, ChevronRight,
} from 'lucide-react';

const BRAND = '#2D6A4F';
const BRAND_TEXT = 'var(--brand-green-text)';

const CLINIC = {
  name: 'Hugory Veterinary Clinic',
  tagline: 'Caring for your pets since 2008',
  phone: '(555) 987-6543',
  emergency: '(555) 987-9999',
  email: 'hello@hugoryvets.com',
  address: '1420 Oak Street, Suite 200',
  city: 'Springfield, IL 62704',
  mapUrl: 'https://maps.google.com/?q=1420+Oak+Street+Springfield+IL',
};

const HOURS = [
  { day: 'Monday',    open: '8:00 AM', close: '6:00 PM', today: true },
  { day: 'Tuesday',   open: '8:00 AM', close: '6:00 PM' },
  { day: 'Wednesday', open: '8:00 AM', close: '7:00 PM' },
  { day: 'Thursday',  open: '8:00 AM', close: '6:00 PM' },
  { day: 'Friday',    open: '8:00 AM', close: '5:00 PM' },
  { day: 'Saturday',  open: '9:00 AM', close: '3:00 PM' },
  { day: 'Sunday',    open: null,       close: null },
];

const TEAM = [
  { name: 'Dr. Sarah Chen',  role: 'Lead Veterinarian', initials: 'DC', color: '#2D6A4F' },
  { name: 'Dr. Raj Patel',   role: 'Veterinarian',      initials: 'RP', color: '#3B82F6' },
  { name: 'Emma Wilson',     role: 'Receptionist',      initials: 'EW', color: '#8B5CF6' },
];

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
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${BRAND}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
      </div>
      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );
}

export default function OwnerContactPage() {
  const [form, setForm] = useState({ name: 'John Smith', email: 'john.smith@email.com', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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
            Get in touch with {CLINIC.name}
          </p>
        </div>

        {/* ── Hero banner ── */}
        <Card style={{ marginBottom: '24px', borderTop: `4px solid ${BRAND}`, overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3px' }}>{CLINIC.name}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{CLINIC.tagline}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href={`tel:${CLINIC.phone.replace(/\D/g, '')}`}
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
                href={`mailto:${CLINIC.email}`}
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
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: `${BRAND}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <Phone style={{ width: '18px', height: '18px', color: BRAND_TEXT }} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Phone</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{CLINIC.phone}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>General enquiries</p>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#d4183d', marginBottom: '2px' }}>Emergency</p>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#d4183d' }}>{CLINIC.emergency}</p>
                </div>
              </Card>

              {/* Email */}
              <Card style={{ padding: '18px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#3B82F615', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <Mail style={{ width: '18px', height: '18px', color: '#3B82F6' }} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Email</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px', wordBreak: 'break-all' }}>{CLINIC.email}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Replies within 24 h</p>
              </Card>

              {/* Address */}
              <Card style={{ padding: '18px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#F59E0B15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <MapPin style={{ width: '18px', height: '18px', color: '#D97706' }} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Address</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{CLINIC.address}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{CLINIC.city}</p>
                <a
                  href={CLINIC.mapUrl}
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
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: `${BRAND}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle style={{ width: '26px', height: '26px', color: BRAND_TEXT }} />
                    </div>
                    <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Message Sent!</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '320px' }}>
                      Our reception team will get back to you within 24 hours. You can also call us directly for urgent matters.
                    </p>
                    <button
                      onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '' })); }}
                      style={{ marginTop: '8px', padding: '9px 20px', borderRadius: '9px', backgroundColor: `${BRAND}15`, color: BRAND_TEXT, border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
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
                        backgroundColor: sending ? `${BRAND}80` : BRAND,
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
                {HOURS.map(h => (
                  <div
                    key={h.day}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
                      backgroundColor: h.today ? `${BRAND}10` : 'transparent',
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
                {TEAM.map(member => (
                  <div key={member.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${member.color}, ${member.color}bb)`,
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
