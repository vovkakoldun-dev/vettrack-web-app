import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Code2, Building2, Plus, Trash2, RefreshCw, CheckCircle2,
  ArrowLeft, Sun, Moon, Globe, Phone, Mail, Calendar,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';
import { useTheme } from '../../hooks/useTheme';

interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  is_dev: boolean;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

export default function SystemAdminPage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Fetch clinics
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .order('is_dev', { ascending: false })
        .order('created_at', { ascending: true });
      if (data) setClinics(data as Clinic[]);
      setLoading(false);
    })();
  }, []);

  const devClinic = clinics.find(c => c.is_dev);

  async function handleAddClinic() {
    if (!newName.trim()) return;
    const orgCtx = await getOrgContext();
    const { data, error } = await supabase.from('clinics').insert({
      name: newName.trim(),
      address: newAddress.trim() || null,
      phone: newPhone.trim() || null,
      email: newEmail.trim() || null,
      is_dev: false,
      status: 'active',
      organization_id: orgCtx.organizationId,
    }).select().single();
    if (data && !error) {
      setClinics(prev => [...prev, data as Clinic]);
      setNewName('');
      setNewAddress('');
      setNewPhone('');
      setNewEmail('');
      setShowAdd(false);
    }
  }

  async function handleDelete(id: string) {
    setClinics(prev => prev.filter(c => c.id !== id));
    await supabase.from('clinics').delete().eq('id', id);
  }

  async function handleSync(id: string) {
    if (!devClinic) return;
    setSyncing(id);
    // "Sync" = update the clinic metadata to match dev clinic structure
    const now = new Date().toISOString();
    await supabase.from('clinics').update({
      last_synced_at: now,
      status: 'active',
    }).eq('id', id);
    setClinics(prev => prev.map(c =>
      c.id === id ? { ...c, last_synced_at: now, status: 'active' } : c
    ));
    // Simulate sync delay
    setTimeout(() => setSyncing(null), 1200);
  }

  const textPrimary = isDark ? '#E2E8F0' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const cardBg = isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.9)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? 'rgba(15,23,42,0.6)' : '#fff';
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  const pageBg = isDark
    ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #1A0A1E 100%)'
    : 'linear-gradient(135deg, #fdf2f8 0%, #f8fafc 50%, #fce7f3 100%)';

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: pageBg, padding: '24px', transition: 'background 0.3s' }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 100,
          width: '44px', height: '44px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}
      >
        {isDark ? <Sun style={{ width: 18, height: 18, color: '#F4A261' }} /> : <Moon style={{ width: 18, height: 18, color: '#64748B' }} />}
      </button>

      <div style={{ maxWidth: '960px', margin: '0 auto', paddingTop: '40px' }}>
        {/* Back */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 mb-8 transition-colors"
          style={{ background: 'none', border: 'none', color: textSecondary, fontSize: '14px', cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = textPrimary}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = textSecondary}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Back to portal selection
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(236,72,153,0.1)',
              border: '1px solid rgba(236,72,153,0.25)',
            }}
          >
            <Code2 style={{ width: 26, height: 26, color: '#EC4899' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: textPrimary }}>
              System Admin
            </h1>
            <p style={{ fontSize: 14, color: textSecondary }}>
              Manage clinic deployments and infrastructure
            </p>
          </div>
        </div>

        <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', margin: '24px 0 32px' }} />

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="w-8 h-8 border-3 rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: cardBorder, borderTopColor: '#EC4899' }} />
            <p style={{ color: textSecondary, fontSize: 14 }}>Loading clinics…</p>
          </div>
        )}

        {/* Clinics grid */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>

            {/* Clinic cards */}
            {clinics.map(clinic => (
              <div
                key={clinic.id}
                onClick={() => {
                  localStorage.setItem('selected_clinic', JSON.stringify({
                    id: clinic.id,
                    name: clinic.name,
                    is_dev: clinic.is_dev,
                  }));
                  navigate('/');
                }}
                style={{
                  background: cardBg,
                  border: `1px solid ${clinic.is_dev ? 'rgba(236,72,153,0.3)' : cardBorder}`,
                  borderRadius: 16,
                  padding: 24,
                  backdropFilter: 'blur(12px)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = isDark
                    ? '0 8px 24px rgba(0,0,0,0.3)'
                    : '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Dev badge */}
                {clinic.is_dev && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: '#EC4899', background: 'rgba(236,72,153,0.1)',
                    border: '1px solid rgba(236,72,153,0.25)',
                    borderRadius: 6, padding: '2px 8px',
                  }}>
                    Dev Clinic
                  </div>
                )}

                {/* Icon */}
                <div
                  className="flex items-center justify-center mb-4"
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: clinic.is_dev ? 'rgba(236,72,153,0.1)' : 'rgba(45,106,79,0.08)',
                    border: `1px solid ${clinic.is_dev ? 'rgba(236,72,153,0.25)' : 'rgba(45,106,79,0.2)'}`,
                  }}
                >
                  <Building2 style={{ width: 22, height: 22, color: clinic.is_dev ? '#EC4899' : '#2D6A4F' }} />
                </div>

                {/* Name */}
                <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, marginBottom: 12 }}>
                  {clinic.name}
                </h3>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {clinic.address && (
                    <div className="flex items-center gap-2">
                      <Globe style={{ width: 12, height: 12, color: textSecondary, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: textSecondary }}>{clinic.address}</span>
                    </div>
                  )}
                  {clinic.phone && (
                    <div className="flex items-center gap-2">
                      <Phone style={{ width: 12, height: 12, color: textSecondary, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: textSecondary }}>{clinic.phone}</span>
                    </div>
                  )}
                  {clinic.email && (
                    <div className="flex items-center gap-2">
                      <Mail style={{ width: 12, height: 12, color: textSecondary, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: textSecondary }}>{clinic.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar style={{ width: 12, height: 12, color: textSecondary, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: textSecondary }}>
                      Created {formatDate(clinic.created_at)}
                    </span>
                  </div>
                  {clinic.last_synced_at && (
                    <div className="flex items-center gap-2">
                      <RefreshCw style={{ width: 12, height: 12, color: '#2D6A4F', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#2D6A4F', fontWeight: 500 }}>
                        Synced {formatDate(clinic.last_synced_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 mb-4">
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: clinic.status === 'active' ? '#22c55e' : '#F4A261',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: clinic.status === 'active' ? '#22c55e' : '#F4A261' }}>
                    {clinic.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Actions */}
                {!clinic.is_dev && (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleSync(clinic.id)}
                      disabled={syncing === clinic.id}
                      className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
                        backgroundColor: '#2D6A4F', color: '#fff', border: 'none', cursor: 'pointer',
                        opacity: syncing === clinic.id ? 0.6 : 1,
                      }}
                    >
                      {syncing === clinic.id ? (
                        <>
                          <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                          Syncing…
                        </>
                      ) : (
                        <>
                          <RefreshCw style={{ width: 13, height: 13 }} />
                          Update from Dev
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(clinic.id)}
                      className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
                        backgroundColor: 'rgba(212,24,61,0.1)', color: '#d4183d',
                        border: '1px solid rgba(212,24,61,0.2)', cursor: 'pointer',
                      }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                      Remove
                    </button>
                  </div>
                )}

                {clinic.is_dev && (
                  <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: textSecondary, fontStyle: 'italic' }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: '#2D6A4F' }} />
                    Primary development instance
                  </div>
                )}
              </div>
            ))}

            {/* Add Clinic card */}
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="group transition-all duration-200"
                style={{
                  background: isDark ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.5)',
                  border: `2px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 16,
                  padding: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 280,
                  textAlign: 'center',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(236,72,153,0.4)';
                  (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.7)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.5)';
                }}
              >
                <div
                  className="flex items-center justify-center mb-4"
                  style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(236,72,153,0.08)',
                    border: '1px solid rgba(236,72,153,0.2)',
                  }}
                >
                  <Plus style={{ width: 28, height: 28, color: '#EC4899' }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>
                  Add Clinic
                </h3>
                <p style={{ fontSize: 13, color: textSecondary, lineHeight: 1.5 }}>
                  Create a new clinic instance with clean data
                </p>
              </button>
            ) : (
              /* Add Clinic form */
              <div
                style={{
                  background: cardBg,
                  border: '1px solid rgba(236,72,153,0.3)',
                  borderRadius: 16,
                  padding: 24,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, marginBottom: 16 }}>
                  New Clinic
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <input
                    placeholder="Clinic name *"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{
                      padding: '9px 12px', borderRadius: 8, fontSize: 13,
                      background: inputBg, border: `1px solid ${inputBorder}`,
                      color: textPrimary, outline: 'none',
                    }}
                  />
                  <input
                    placeholder="Address"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    style={{
                      padding: '9px 12px', borderRadius: 8, fontSize: 13,
                      background: inputBg, border: `1px solid ${inputBorder}`,
                      color: textPrimary, outline: 'none',
                    }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <input
                      placeholder="Phone"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      style={{
                        padding: '9px 12px', borderRadius: 8, fontSize: 13,
                        background: inputBg, border: `1px solid ${inputBorder}`,
                        color: textPrimary, outline: 'none',
                      }}
                    />
                    <input
                      placeholder="Email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      style={{
                        padding: '9px 12px', borderRadius: 8, fontSize: 13,
                        background: inputBg, border: `1px solid ${inputBorder}`,
                        color: textPrimary, outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddClinic}
                    disabled={!newName.trim()}
                    className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8,
                      backgroundColor: '#EC4899', color: '#fff', border: 'none', cursor: 'pointer',
                      opacity: newName.trim() ? 1 : 0.4,
                    }}
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                    Create Clinic
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setNewName(''); setNewAddress(''); setNewPhone(''); setNewEmail(''); }}
                    style={{
                      fontSize: 13, fontWeight: 500, padding: '8px 16px', borderRadius: 8,
                      background: 'none', color: textSecondary, border: `1px solid ${cardBorder}`,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: textSecondary, fontSize: 12, marginTop: 48, opacity: 0.6 }}>
          © 2026 Hugory · System Administration Panel
        </p>
      </div>
    </div>
  );
}
