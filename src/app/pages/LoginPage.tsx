import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Stethoscope, ShieldCheck, Crown, PawPrint, Code2,
  Eye, EyeOff, ArrowLeft, ChevronRight, Sun, Moon, UserPlus,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { portalForRole, type PortalId } from '../../lib/portal';

type Role = 'doctor' | 'admin' | 'superadmin' | 'patient' | 'sysadmin';

type RoleCard = {
  id: Role;
  label: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  ring: string;
  defaultEmail: string;
};

const ROLES: RoleCard[] = [
  {
    id: 'doctor',
    label: 'Doctor / Vet',
    subtitle: 'Veterinarian Portal',
    description: 'Access patient records, appointments, lab results, and clinical tools.',
    icon: Stethoscope,
    color: '#2D6A4F',
    bg: 'rgba(45,106,79,0.08)',
    border: 'rgba(45,106,79,0.25)',
    ring: 'rgba(45,106,79,0.4)',
    defaultEmail: 'sarah.chen@vettrack.com',
  },
  {
    id: 'admin',
    label: 'Admin',
    subtitle: 'Front Desk',
    description: 'Front desk operations — handle bookings, check-ins, scheduling, and client intake.',
    icon: ShieldCheck,
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    ring: 'rgba(59,130,246,0.4)',
    defaultEmail: 'admin@vettrack.com',
  },
  {
    id: 'superadmin',
    label: 'Super Admin',
    subtitle: 'Clinic Management',
    description: 'Full clinic oversight — manage staff, billing, operations, and system-wide configuration.',
    icon: Crown,
    color: '#F4A261',
    bg: 'rgba(244,162,97,0.08)',
    border: 'rgba(244,162,97,0.25)',
    ring: 'rgba(244,162,97,0.4)',
    defaultEmail: 'superadmin@vettrack.com',
  },
  {
    id: 'patient',
    label: 'Pet Owner',
    subtitle: 'Client Portal',
    description: 'View your pets\' health records, upcoming appointments, and invoices.',
    icon: PawPrint,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    ring: 'rgba(139,92,246,0.4)',
    defaultEmail: 'owner@vettrack.dev',
  },
  {
    id: 'sysadmin',
    label: 'System Admin',
    subtitle: 'Developer',
    description: 'Manage clinics, deploy updates, and oversee the entire platform infrastructure.',
    icon: Code2,
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
    ring: 'rgba(236,72,153,0.4)',
    defaultEmail: 'dev@hugory.com',
  },
];

/** Maps each login-card id to the portal it represents. */
const CARD_TO_PORTAL: Record<Role, PortalId> = {
  doctor: 'doctor',
  admin: 'admin',
  superadmin: 'superadmin',
  patient: 'owner',
  sysadmin: 'sysadmin',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const { signIn, signUp } = useAuth();
  const [selected, setSelected] = useState<Role | null>(() => {
    const saved = sessionStorage.getItem('vettrack_portal_selected');
    if (saved) { sessionStorage.removeItem('vettrack_portal_selected'); return saved as Role; }
    return null;
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(() => {
    const saved = sessionStorage.getItem('vettrack_portal_error');
    if (saved) { sessionStorage.removeItem('vettrack_portal_error'); return saved; }
    return null;
  });
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const activeRole = ROLES.find(r => r.id === selected);

  function selectRole(role: Role) {
    setSelected(role);
    setEmail('');
    setPassword('');
    setAuthError(null);
    setSignUpSuccess(false);
  }

  function handleBack() {
    setSelected(null);
    setEmail('');
    setPassword('');
    setShowPass(false);
    setAuthError(null);
    setIsSignUp(false);
    setSignUpSuccess(false);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) { setAuthError(error); return; }
      setSignUpSuccess(true);
      return;
    }

    // ── Sign in with portal validation ────────────────────────
    // Set flag BEFORE signIn so PublicRoute won't redirect to the dashboard
    // while we verify the user's role matches the selected portal card.
    sessionStorage.setItem('vettrack_portal_validating', 'true');

    const { error } = await signIn(email, password);
    if (error) {
      sessionStorage.removeItem('vettrack_portal_validating');
      setLoading(false);
      setAuthError(error);
      return;
    }

    // Fetch the authenticated user's profile role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      sessionStorage.removeItem('vettrack_portal_validating');
      setLoading(false);
      setAuthError('Unable to verify your account. Please try again.');
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.role) {
      // Persist error + selected card across the signOut-triggered remount
      const errorMsg = profileErr
        ? 'Unable to verify your account. Please try again.'
        : 'No role assigned to this account. Contact your administrator.';
      sessionStorage.setItem('vettrack_portal_error', errorMsg);
      sessionStorage.setItem('vettrack_portal_selected', selected!);
      await supabase.auth.signOut();
      sessionStorage.removeItem('vettrack_portal_validating');
      setLoading(false);
      setAuthError(errorMsg);
      return;
    }

    const userPortal = portalForRole(profile.role);
    const selectedPortal = CARD_TO_PORTAL[selected!];

    // Sysadmin portal is special — only superadmin role can access it
    const allowed = selectedPortal === 'sysadmin'
      ? profile.role === 'superadmin'
      : userPortal === selectedPortal;

    if (!allowed) {
      // Persist error + selected card so LoginPage can show the message even if
      // the auth state change causes a component remount.
      const portalLabel = activeRole?.label ?? selected;
      const errorMsg = `This account does not have access to the ${portalLabel} portal. Please select the correct portal for your role.`;
      sessionStorage.setItem('vettrack_portal_error', errorMsg);
      sessionStorage.setItem('vettrack_portal_selected', selected!);
      await supabase.auth.signOut();
      sessionStorage.removeItem('vettrack_portal_validating');
      setLoading(false);
      setAuthError(errorMsg);
      return;
    }

    // ── Role matches — proceed with navigation ───────────────
    sessionStorage.removeItem('vettrack_portal_validating');
    setLoading(false);
    if (selected === 'sysadmin') navigate('/sysadmin');
    else if (selected === 'superadmin') navigate('/superadmin');
    else if (selected === 'admin') navigate('/admin');
    else if (selected === 'patient') navigate('/owner');
    else navigate('/');
  }

  const pageBg = isDark
    ? '#08090E'
    : '#E3E8FF';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: pageBg, padding: '24px', transition: 'background 0.3s', overflow: 'hidden', position: 'relative' }}
    >
      <style>{`
        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(120px, -80px) scale(1.1); }
          40% { transform: translate(-60px, 100px) scale(0.95); }
          60% { transform: translate(80px, 60px) scale(1.05); }
          80% { transform: translate(-100px, -40px) scale(0.9); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-100px, 60px) scale(1.08); }
          40% { transform: translate(70px, -90px) scale(0.92); }
          60% { transform: translate(-80px, -50px) scale(1.12); }
          80% { transform: translate(110px, 80px) scale(0.95); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(90px, 70px) scale(1.15); }
          50% { transform: translate(-110px, -30px) scale(0.9); }
          75% { transform: translate(50px, -80px) scale(1.05); }
        }
        @keyframes blobFloat4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-70px, -90px) scale(1.1); }
          50% { transform: translate(100px, 50px) scale(0.88); }
          80% { transform: translate(-50px, 70px) scale(1.08); }
        }
      `}</style>
      {/* ── Theme toggle ── */}
      <button
        onClick={toggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 100,
          width: '44px', height: '44px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isDark
          ? <Sun style={{ width: '18px', height: '18px', color: '#F4A261' }} />
          : <Moon style={{ width: '18px', height: '18px', color: '#475569' }} />
        }
      </button>

      {/* Flying gradient blobs — logo colors */}
      {isDark && <>
        {/* Blue #1184FF — large, center-left */}
        <div style={{
          position: 'fixed', top: '-10%', left: '-5%',
          width: '900px', height: '900px',
          background: 'radial-gradient(circle, rgba(17,132,255,0.35) 0%, rgba(17,132,255,0.08) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat1 18s ease-in-out infinite',
        }} />
        {/* Teal #0ACEA9 — bottom-left */}
        <div style={{
          position: 'fixed', bottom: '-15%', left: '-10%',
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(10,206,169,0.40) 0%, rgba(10,206,169,0.08) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat3 20s ease-in-out infinite',
        }} />
        {/* Purple #845FEE — center */}
        <div style={{
          position: 'fixed', top: '10%', left: '30%',
          width: '850px', height: '850px',
          background: 'radial-gradient(circle, rgba(132,95,238,0.30) 0%, rgba(132,95,238,0.06) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat2 22s ease-in-out infinite',
        }} />
        {/* Orange #FF8315 — right */}
        <div style={{
          position: 'fixed', top: '5%', right: '-10%',
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(255,131,21,0.28) 0%, rgba(255,131,21,0.05) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat4 24s ease-in-out infinite',
        }} />
        {/* Deep blue #3E3CFF — subtle accent */}
        <div style={{
          position: 'fixed', bottom: '10%', left: '20%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(62,60,255,0.18) 0%, transparent 60%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat1 26s ease-in-out infinite',
        }} />
      </>}
      {!isDark && <>
        {/* Blue #1184FF — large, center-left */}
        <div style={{
          position: 'fixed', top: '-10%', left: '-5%',
          width: '900px', height: '900px',
          background: 'radial-gradient(circle, rgba(17,132,255,0.45) 0%, rgba(17,132,255,0.10) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat1 18s ease-in-out infinite',
        }} />
        {/* Teal #0ACEA9 — bottom-left */}
        <div style={{
          position: 'fixed', bottom: '-15%', left: '-10%',
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(10,206,169,0.55) 0%, rgba(10,206,169,0.12) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat3 20s ease-in-out infinite',
        }} />
        {/* Purple #845FEE — center */}
        <div style={{
          position: 'fixed', top: '10%', left: '30%',
          width: '850px', height: '850px',
          background: 'radial-gradient(circle, rgba(132,95,238,0.40) 0%, rgba(132,95,238,0.08) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat2 22s ease-in-out infinite',
        }} />
        {/* Orange #FF8315 — right */}
        <div style={{
          position: 'fixed', top: '5%', right: '-10%',
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(255,131,21,0.38) 0%, rgba(255,131,21,0.08) 50%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat4 24s ease-in-out infinite',
        }} />
        {/* Deep blue #3E3CFF — subtle accent */}
        <div style={{
          position: 'fixed', bottom: '10%', left: '20%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(62,60,255,0.25) 0%, transparent 60%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(100px)',
          animation: 'blobFloat1 26s ease-in-out infinite',
        }} />
      </>}

      {/* Logo */}
      <div className="flex items-center justify-center mb-10" style={{ position: 'relative', zIndex: 1 }}>
        <img src={isDark ? '/logo-full-dark.svg' : '/logo-full.svg'} alt="HugoIT" style={{ height: '52px' }} />
      </div>

      {/* Card container */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: selected ? '420px' : '780px',
          transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Role selection ───────────────────────────────────────── */}
        {!selected && (
          <>
            <div className="text-center mb-8">
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: isDark ? '#E2E8F0' : '#0F172A', marginBottom: '8px' }}>
                Welcome back
              </h1>
              <p style={{ fontSize: '15px', color: isDark ? '#94A3B8' : '#64748B' }}>
                Choose your portal to continue
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                position: 'relative',
              }}
            >
              {ROLES.filter(r => r.id !== 'sysadmin').map(role => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => selectRole(role.id)}
                    className="group text-left transition-all duration-200"
                    style={{
                      background: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.85)',
                      border: `1px solid ${role.border}`,
                      borderRadius: '16px',
                      padding: '24px',
                      backdropFilter: 'blur(12px)',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = isDark
                        ? `0 0 0 2px ${role.ring}, 0 8px 32px rgba(0,0,0,0.3)`
                        : `0 0 0 2px ${role.ring}, 0 8px 28px rgba(0,0,0,0.08)`;
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Icon badge */}
                    <div
                      className="flex items-center justify-center mb-4"
                      style={{
                        width: '52px', height: '52px', borderRadius: '14px',
                        background: role.bg,
                        border: `1px solid ${role.border}`,
                      }}
                    >
                      <Icon style={{ width: '26px', height: '26px', color: role.color }} />
                    </div>

                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '17px', fontWeight: 700, color: isDark ? '#E2E8F0' : '#0F172A' }}>
                        {role.label}
                      </span>
                      <span
                        style={{
                          marginLeft: '8px', fontSize: '11px', fontWeight: 600,
                          color: role.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: role.bg, borderRadius: '4px', padding: '1px 6px',
                        }}
                      >
                        {role.subtitle}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: isDark ? '#94A3B8' : '#64748B', lineHeight: 1.5, marginBottom: '16px' }}>
                      {role.description}
                    </p>

                    <div className="flex items-center gap-1" style={{ color: role.color, fontSize: '13px', fontWeight: 600 }}>
                      Sign in
                      <ChevronRight style={{ width: '14px', height: '14px' }} />
                    </div>
                  </button>
                );
              })}
              {/* Minimized System Admin icon */}
              {(() => {
                const sysRole = ROLES.find(r => r.id === 'sysadmin')!;
                const SysIcon = sysRole.icon;
                return (
                  <button
                    key="sysadmin"
                    onClick={() => selectRole('sysadmin')}
                    title="System Admin"
                    className="flex items-center justify-center transition-all duration-200"
                    style={{
                      width: '48px', height: '48px', borderRadius: '14px',
                      background: sysRole.bg,
                      border: `1px solid ${sysRole.border}`,
                      cursor: 'pointer', outline: 'none',
                      position: 'absolute', bottom: '-60px', right: '0',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${sysRole.ring}`;
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                    }}
                  >
                    <SysIcon style={{ width: '22px', height: '22px', color: sysRole.color }} />
                  </button>
                );
              })()}
            </div>
          </>
        )}

        {/* ── Login form ───────────────────────────────────────────── */}
        {selected && activeRole && (
          <>
            {/* Back */}
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 mb-6 transition-colors"
              style={{ background: 'none', border: 'none', color: isDark ? '#94A3B8' : '#64748B', fontSize: '14px', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = isDark ? '#E2E8F0' : '#0F172A'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = isDark ? '#94A3B8' : '#64748B'}
            >
              <ArrowLeft style={{ width: '15px', height: '15px' }} />
              Back to portal selection
            </button>

            <div
              style={{
                background: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.92)',
                border: `1px solid ${activeRole.border}`,
                borderRadius: '20px',
                padding: '36px',
                backdropFilter: 'blur(16px)',
                boxShadow: isDark
                  ? `0 0 40px rgba(0,0,0,0.3), 0 0 0 1px ${activeRole.border}`
                  : `0 8px 40px rgba(0,0,0,0.08), 0 0 0 1px ${activeRole.border}`,
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: activeRole.bg,
                    border: `1px solid ${activeRole.border}`,
                    boxShadow: `0 0 20px ${activeRole.ring}`,
                  }}
                >
                  <activeRole.icon style={{ width: '28px', height: '28px', color: activeRole.color }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, color: isDark ? '#E2E8F0' : '#0F172A', marginBottom: '2px' }}>
                    {activeRole.label}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748B' }}>
                    {activeRole.subtitle}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSignIn}>
                {/* Email */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="email"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: isDark ? '#94A3B8' : '#475569', marginBottom: '6px' }}
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    placeholder="you@example.com"
                    onChange={e => setEmail(e.target.value)}
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.9)',
                      border: isDark ? `1px solid rgba(51,65,85,0.8)` : `1px solid rgba(203,213,225,0.8)`,
                      borderRadius: '10px',
                      color: isDark ? '#E2E8F0' : '#0F172A',
                      fontSize: '15px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = activeRole.color}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = isDark ? 'rgba(51,65,85,0.8)' : 'rgba(203,213,225,0.8)'}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: '24px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                    <label
                      htmlFor="password"
                      style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#94A3B8' : '#475569' }}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', fontSize: '12px', color: activeRole.color, cursor: 'pointer', padding: 0, fontWeight: 500 }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        width: '100%', padding: '11px 40px 11px 14px',
                        background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.9)',
                        border: isDark ? `1px solid rgba(51,65,85,0.8)` : `1px solid rgba(203,213,225,0.8)`,
                        borderRadius: '10px',
                        color: isDark ? '#E2E8F0' : '#0F172A',
                        fontSize: '15px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => (e.target as HTMLElement).style.borderColor = activeRole.color}
                      onBlur={e => (e.target as HTMLElement).style.borderColor = isDark ? 'rgba(51,65,85,0.8)' : 'rgba(203,213,225,0.8)'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#64748B', padding: 0, display: 'flex',
                      }}
                    >
                      {showPass
                        ? <EyeOff style={{ width: '16px', height: '16px' }} />
                        : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>

                {/* Auth error */}
                {authError && (
                  <div style={{
                    marginBottom: '16px', padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: 'rgba(212,24,61,0.08)', border: '1px solid rgba(212,24,61,0.2)',
                    color: '#d4183d', fontSize: '13px', lineHeight: 1.5,
                  }}>
                    {authError}
                  </div>
                )}

                {/* Sign up success */}
                {signUpSuccess && (
                  <div style={{
                    marginBottom: '16px', padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 20%, transparent)',
                    color: 'var(--brand-green-text)', fontSize: '13px', lineHeight: 1.5,
                  }}>
                    Account created! Check your email to confirm, then sign in.
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || signUpSuccess}
                  className="w-full flex items-center justify-center gap-2 transition-all duration-200"
                  style={{
                    padding: '13px 20px',
                    background: (loading || signUpSuccess)
                      ? 'color-mix(in srgb, var(--brand-green-text) 50%, transparent)'
                      : `linear-gradient(135deg, ${activeRole.color}, ${activeRole.color}dd)`,
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: (loading || signUpSuccess) ? 'not-allowed' : 'pointer',
                    boxShadow: (loading || signUpSuccess) ? 'none' : `0 4px 20px ${activeRole.ring}`,
                    letterSpacing: '-0.1px',
                  }}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin"
                        style={{ width: '16px', height: '16px' }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" />
                      </svg>
                      {isSignUp ? 'Creating account…' : 'Signing in…'}
                    </>
                  ) : isSignUp ? (
                    <>
                      <UserPlus style={{ width: '16px', height: '16px' }} />
                      Create account
                    </>
                  ) : (
                    `Sign in as ${activeRole.label}`
                  )}
                </button>
              </form>

            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <p style={{ position: 'relative', zIndex: 1, marginTop: '40px', fontSize: '12px', color: isDark ? '#94A3B8' : '#475569' }}>
        © 2026 HugoIT · Secure veterinary management platform
      </p>
    </div>
  );
}
