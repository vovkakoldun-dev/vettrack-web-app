import { useState, useEffect, useCallback } from 'react';
import {
  User, Palette, Shield, Trash2, Camera, Save, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Moon, Sun, Lock, Key,
  Leaf, Sunrise, Smartphone, LogOut, Check, Zap,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenantDb } from '../../context/TenantContext';// hashSessionToken no longer needed — using stable sessionStorage token
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { updateProfile, uploadAvatar, removeAvatar } from '../../hooks/useProfile';
import { useTheme as useThemeHook, LIGHT_THEMES, DARK_THEMES, type ThemeStyle } from '../../hooks/useTheme';
import { useOwnerClient } from '../../hooks/useOwnerClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsSection = 'profile' | 'appearance' | 'security' | 'account';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = 'var(--brand-green-text)';
const BRAND_TEXT = 'var(--brand-green-text)';

const NAV_ITEMS: NavItem[] = [
  { id: 'profile',    label: 'Profile',    icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security',   label: 'Security',   icon: Shield },
  { id: 'account',    label: 'Account',    icon: Trash2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[var(--surface-white)] border border-[var(--border-color)] p-6 ${className}`}
      style={{ borderRadius: '12px' }}
    >
      {children}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-5 border-b border-[var(--border-color)] last:border-0">
      <div>
        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
          {label}
        </p>
        {hint && (
          <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '12px' }}>
            {hint}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SaveBar({ onSave, saved, saving }: { onSave: () => void; saved: boolean; saving?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4">
      {saved && (
        <span className="flex items-center gap-1.5 text-[var(--brand-green-text)]" style={{ fontSize: '14px' }}>
          <CheckCircle2 className="w-4 h-4" />
          Saved successfully
        </span>
      )}
      <Button size="sm" onClick={onSave} disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OwnerSettingsPage() {
  const db = useTenantDb();
  const { user } = useAuth();
  const { client } = useOwnerClient();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [savedSection, setSavedSection] = useState<SettingsSection | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profileId, setProfileId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  // Load profile from Supabase
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profileData } = await db
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url')
        .eq('id', user.id)
        .single();
      if (profileData) {
        setProfileId(profileData.id);
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setEmail(profileData.email || '');
        setPhone(profileData.phone || '');
        setProfilePhoto(profileData.avatar_url || '');
      }
    })();
  }, [user]);

  // ── Appearance state ───────────────────────────────────────────────────────
  const { themeStyle: currentTheme, setThemeStyle: applyTheme, selectedLightTheme, selectedDarkTheme } = useThemeHook();

  // ── Security state ─────────────────────────────────────────────────────────
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // ── Sessions ───────────────────────────────────────────────────────────────
  interface SessionRow { id: string; device: string; browser: string; location: string; is_current: boolean; last_active_at: string; }
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const parseUserAgent = useCallback(() => {
    const ua = navigator.userAgent;
    let device = 'Unknown Device';
    let browser = 'Unknown Browser';
    if (/Macintosh|MacIntel/.test(ua)) device = 'Mac';
    else if (/Windows/.test(ua)) device = 'Windows PC';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/Android/.test(ua) && /Mobile/.test(ua)) device = 'Android Phone';
    else if (/Android/.test(ua)) device = 'Android Tablet';
    else if (/Linux/.test(ua)) device = 'Linux PC';
    if (/Edg\/(\d+)/.test(ua)) browser = `Edge ${RegExp.$1}`;
    else if (/Chrome\/(\d+)/.test(ua)) browser = `Chrome ${RegExp.$1}`;
    else if (/Firefox\/(\d+)/.test(ua)) browser = `Firefox ${RegExp.$1}`;
    else if (/Version\/(\d+).*Safari/.test(ua)) browser = `Safari ${RegExp.$1}`;
    return { device, browser };
  }, []);

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setSessionsLoading(true);
    try {
      const { device, browser } = parseUserAgent();

      let token = sessionStorage.getItem('vettrack_session_token');
      if (!token) {
        token = crypto.randomUUID();
        sessionStorage.setItem('vettrack_session_token', token);
      }

      await db.from('user_sessions').upsert(
        { user_id: user.id, session_token: token, device, browser, location: 'Unknown', is_current: true, last_active_at: new Date().toISOString() },
        { onConflict: 'session_token' }
      );

      await db.from('user_sessions').update({ is_current: false }).eq('user_id', user.id).neq('session_token', token);

      const { data: allSessions } = await db.from('user_sessions').select('*').eq('user_id', user.id).order('last_active_at', { ascending: false });
      if (allSessions && allSessions.length > 5) {
        const staleIds = allSessions.slice(5).map(s => s.id);
        await db.from('user_sessions').delete().in('id', staleIds);
      }
      setSessions((allSessions || []).slice(0, 5));
    } catch (e) {
      console.error('Error loading sessions:', e);
    }
    setSessionsLoading(false);
  }, [user, parseUserAgent]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const revokeSession = async (sessionId: string) => {
    await db.from('user_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const signOutAll = async () => {
    if (!user) return;
    await db.from('user_sessions').delete().eq('user_id', user.id);
    await supabase.auth.signOut({ scope: 'global' });
  };

  // ── Account state ──────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = async (section: SettingsSection) => {
    if (section === 'profile' && profileId) {
      setSaving(true);
      await updateProfile(profileId, { first_name: firstName, last_name: lastName, email, phone });
      setSaving(false);
    }

    if (section === 'security') {
      if (!currentPw || !newPw || newPw !== confirmPw || newPw.length < 12) return;
      setSaving(true);
      setPwError(null);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) { setSaving(false); setPwError('Unable to verify user.'); return; }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: currentPw });
      if (signInErr) { setSaving(false); setPwError('Current password is incorrect.'); return; }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      setSaving(false);
      if (updateErr) { setPwError(updateErr.message); return; }
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }

    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 3000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }} className="p-4 md:p-8">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div className="mb-6">
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage your account and preferences.
          </p>
        </div>

        {/* Grid: nav + content */}
        <div className="grid grid-cols-[220px_1fr] gap-6">
          {/* Nav sidebar */}
          <nav
            className="bg-[var(--surface-white)] border border-[var(--border-color)] p-3"
            style={{ borderRadius: '12px', alignSelf: 'start' }}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 last:mb-0 transition-colors ${
                    isActive
                      ? 'bg-[var(--surface-elevated)] text-[var(--brand-green-text)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                  style={{ borderRadius: '8px', textAlign: 'left', border: 'none', cursor: 'pointer', background: isActive ? 'var(--surface-elevated)' : 'transparent' }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? BRAND_TEXT : undefined }} />
                  <span style={{ fontSize: '14px', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="space-y-6">

            {/* ════════════════════════════════════════════════════ PROFILE */}
            {activeSection === 'profile' && (
              <>
                {/* Avatar */}
                <SectionCard>
                  <h3 className="text-[var(--text-primary)] mb-1">Profile photo</h3>
                  <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                    This is displayed on your account and visible to your clinic.
                  </p>
                  <div className="flex items-center gap-5">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-20 h-20 object-cover" style={{ borderRadius: '9999px' }} />
                    ) : (
                      <div className="w-20 h-20 bg-[var(--brand-green-bg)] text-[var(--brand-green-text)] flex items-center justify-center" style={{ borderRadius: '9999px', fontSize: '24px', fontWeight: 700 }}>
                        {(firstName?.[0] || '').toUpperCase()}{(lastName?.[0] || '').toUpperCase()}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (ev: any) => {
                          const file = ev.target.files?.[0];
                          if (!file || !profileId) return;
                          try {
                            const publicUrl = await uploadAvatar(profileId, file, 'owner');
                            setProfilePhoto(publicUrl);
                          } catch (err: any) {
                            alert(err.message);
                          }
                        };
                        input.click();
                      }}>
                        <Camera className="w-4 h-4" />
                        Upload new photo
                      </Button>
                      {profilePhoto && (
                        <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]" onClick={async () => {
                          if (!profileId || !confirm('Remove your profile photo?')) return;
                          try {
                            await removeAvatar(profileId, 'owner');
                            setProfilePhoto('');
                          } catch (err: any) {
                            console.error('Delete error:', err);
                          }
                        }}>
                          <Trash2 className="w-4 h-4" />
                          Remove photo
                        </Button>
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                        JPG, GIF or PNG · Max 2 MB
                      </p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', marginTop: '2px' }}>
                        Recommended: 400×400 px
                      </p>
                    </div>
                  </div>
                </SectionCard>

                {/* Personal Info */}
                <SectionCard>
                  <h3 className="text-[var(--text-primary)] mb-1">Personal information</h3>
                  <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
                    Update your name and contact details.
                  </p>
                  <Separator className="mb-2" />

                  <FieldRow label="Full name">
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                    </div>
                  </FieldRow>

                  <FieldRow label="Email address" hint="Used for login and notifications">
                    <Input type="email" value={email} disabled className="opacity-60 cursor-not-allowed" />
                  </FieldRow>

                  <FieldRow label="Phone number">
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </FieldRow>

                  <SaveBar onSave={() => handleSave('profile')} saved={savedSection === 'profile'} saving={saving} />
                </SectionCard>
              </>
            )}

            {/* ════════════════════════════════════════════════ APPEARANCE */}
            {activeSection === 'appearance' && (
              <>
                <SectionCard>
                  <h3 className="text-[var(--text-primary)] mb-1">Theme</h3>
                  <p className="text-[var(--text-secondary)] mb-4" style={{ fontSize: '14px' }}>
                    Pick a theme for each mode. The sidebar toggle switches between them.
                  </p>

                  {/* Light Themes */}
                  <div className="flex items-center gap-2 mb-3">
                    <Sun className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>Light Themes</span>
                  </div>
                  <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    {LIGHT_THEMES.map(({ value, label, description, preview }) => {
                      const isSelected = selectedLightTheme === value;
                      const iconMap: Record<string, typeof Sun> = {
                        light: Sun, pastel: Palette, sage: Leaf, sand: Sunrise,
                      };
                      const Icon = iconMap[value] || Palette;
                      return (
                        <button
                          key={value}
                          onClick={() => applyTheme(value as ThemeStyle)}
                          className="p-3 border transition-all text-left group"
                          style={{
                            borderRadius: '12px',
                            borderColor: isSelected ? BRAND_TEXT : 'var(--border-color)',
                            backgroundColor: isSelected ? 'color-mix(in srgb, var(--brand-green-text) 6%, var(--surface-elevated))' : 'var(--surface-elevated)',
                            boxShadow: isSelected ? `0 0 0 1px ${BRAND_TEXT}` : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            className="w-full mb-3 border border-[var(--border-color)] overflow-hidden"
                            style={{ borderRadius: '8px', background: preview, height: 56, position: 'relative' }}
                          >
                            <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 3 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? BRAND_TEXT : 'var(--text-secondary)' }} />
                              <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? BRAND_TEXT : 'var(--text-primary)' }}>
                                {label}
                              </span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand-green-text)]" />}
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3, margin: 0 }}>
                            {description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dark Themes */}
                  <div className="flex items-center gap-2 mb-3">
                    <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>Dark Themes</span>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    {DARK_THEMES.map(({ value, label, description, preview }) => {
                      const isSelected = selectedDarkTheme === value;
                      const iconMap: Record<string, typeof Sun> = {
                        dark: Moon, midnight: Moon, glass: Zap, contrast: Eye,
                      };
                      const Icon = iconMap[value] || Moon;
                      return (
                        <button
                          key={value}
                          onClick={() => applyTheme(value as ThemeStyle)}
                          className="p-3 border transition-all text-left group"
                          style={{
                            borderRadius: '12px',
                            borderColor: isSelected ? BRAND_TEXT : 'var(--border-color)',
                            backgroundColor: isSelected ? 'color-mix(in srgb, var(--brand-green-text) 6%, var(--surface-elevated))' : 'var(--surface-elevated)',
                            boxShadow: isSelected ? `0 0 0 1px ${BRAND_TEXT}` : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            className="w-full mb-3 border border-[var(--border-color)] overflow-hidden"
                            style={{ borderRadius: '8px', background: preview, height: 56, position: 'relative' }}
                          >
                            <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 3 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? BRAND_TEXT : 'var(--text-secondary)' }} />
                              <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? BRAND_TEXT : 'var(--text-primary)' }}>
                                {label}
                              </span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand-green-text)]" />}
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3, margin: 0 }}>
                            {description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ═══════════════════════════════════════════════════ SECURITY */}
            {activeSection === 'security' && (
              <>
                {/* Password */}
                <SectionCard>
                  <h3 className="text-[var(--text-primary)] mb-1">Change password</h3>
                  <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
                    Use a strong password of at least 12 characters. We recommend including uppercase, lowercase, numbers, and symbols.
                  </p>
                  <Separator className="mb-2" />

                  <FieldRow label="Current password">
                    <div className="relative">
                      <Input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="Enter current password"
                        className="pr-10"
                      />
                      <button
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FieldRow>

                  <FieldRow label="New password">
                    <div className="relative">
                      <Input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="At least 12 characters"
                        className="pr-10"
                      />
                      <button
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPw.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {[
                          { label: 'At least 12 characters', met: newPw.length >= 12 },
                          { label: 'Uppercase letter',       met: /[A-Z]/.test(newPw) },
                          { label: 'Number',                 met: /\d/.test(newPw) },
                          { label: 'Special character',      met: /[^A-Za-z0-9]/.test(newPw) },
                        ].map(({ label, met }) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: met ? BRAND_TEXT : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '12px', color: met ? BRAND_TEXT : 'var(--text-secondary)' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </FieldRow>

                  <FieldRow label="Confirm new password">
                    <div className="relative">
                      <Input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Repeat new password"
                        className="pr-10"
                      />
                      <button
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPw.length > 0 && newPw !== confirmPw && (
                      <p className="text-[#d4183d] mt-1.5" style={{ fontSize: '12px' }}>Passwords do not match</p>
                    )}
                  </FieldRow>

                  {pwError && (
                    <p className="text-[#d4183d] mt-2" style={{ fontSize: '13px' }}>{pwError}</p>
                  )}
                  <div className="pt-4 flex justify-end">
                    <Button
                      disabled={!currentPw || !newPw || newPw !== confirmPw || newPw.length < 12 || saving}
                      onClick={() => handleSave('security')}
                    >
                      <Key className="w-4 h-4" />
                      {saving ? 'Updating...' : 'Update password'}
                    </Button>
                  </div>
                </SectionCard>

                {/* 2FA */}
                <SectionCard>
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h3 className="text-[var(--text-primary)] mb-1">Two-factor authentication</h3>
                      <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
                        Add an extra layer of security to your account. When enabled, you'll need to enter a code from your authenticator app when logging in from a new device.
                      </p>
                      {twoFaEnabled && (
                        <div className="flex items-center gap-2 mt-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1"
                            style={{ backgroundColor: '#74C69D20', color: BRAND_TEXT, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enabled — Authenticator app
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Switch checked={twoFaEnabled} onCheckedChange={setTwoFaEnabled} />
                      {twoFaEnabled && (
                        <Button variant="outline" size="sm">Manage</Button>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Active sessions */}
                <SectionCard>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[var(--text-primary)]">Active sessions</h3>
                    <Button variant="outline" size="sm" className="text-[#d4183d] border-[#d4183d] hover:bg-[#d4183d10] hover:text-[#d4183d]" onClick={signOutAll}>
                      <LogOut className="w-4 h-4" />
                      Sign out all
                    </Button>
                  </div>
                  <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                    These devices are currently logged into your account.
                  </p>

                  <div className="space-y-3">
                    {sessionsLoading ? (
                      <p className="text-[var(--text-secondary)] text-center py-6" style={{ fontSize: '14px' }}>Loading sessions...</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-[var(--text-secondary)] text-center py-6" style={{ fontSize: '14px' }}>No active sessions found.</p>
                    ) : (showAllSessions ? sessions : sessions.slice(0, 4)).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-4 border border-[var(--border-color)] bg-[var(--surface-elevated)]"
                        style={{ borderRadius: '10px' }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center justify-center flex-shrink-0"
                            style={{ borderRadius: '8px' }}
                          >
                            <Smartphone className="w-5 h-5 text-[var(--text-secondary)]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                                {s.device}
                              </p>
                              {s.is_current && (
                                <Badge variant="outline" className="border-[var(--brand-green-text)] text-[var(--brand-green-text)]" style={{ fontSize: '11px' }}>
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                              {s.browser} · {s.location} · {formatRelativeTime(s.last_active_at)}
                            </p>
                          </div>
                        </div>
                        {!s.is_current && (
                          <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]" onClick={() => revokeSession(s.id)}>
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                    {sessions.length > 4 && (
                      <button
                        onClick={() => setShowAllSessions(!showAllSessions)}
                        style={{
                          width: '100%', padding: '10px', borderRadius: '8px',
                          border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)',
                          fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                      >
                        {showAllSessions ? 'Show less' : `Show ${sessions.length - 4} more`}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showAllSessions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ═══════════════════════════════════════════════════ ACCOUNT */}
            {activeSection === 'account' && (
              <>
                {deleteRequested && (
                  <SectionCard>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                      <CheckCircle2 style={{ width: '20px', height: '20px', color: BRAND_TEXT, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Deletion request submitted</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>A clinic administrator will review your request. You'll receive an email confirmation.</p>
                      </div>
                    </div>
                  </SectionCard>
                )}

                <SectionCard>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#DC2626', marginBottom: '4px' }}>Danger Zone</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    These actions are irreversible. Please be certain.
                  </p>
                  <Separator className="mb-4" />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Request account deletion</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Submit a request to permanently delete your account and all associated data.
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Request Deletion
                    </Button>
                  </div>
                </SectionCard>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteDialogOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteDialogOpen(false)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--surface-white)', borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle style={{ width: '20px', height: '20px', color: '#DC2626' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Delete Account?</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
              This will submit a request to permanently delete your account. A clinic administrator will review and process your request.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              All your data including pet records, appointment history, and invoices will be removed. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { setDeleteDialogOpen(false); setDeleteRequested(true); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Confirm Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
