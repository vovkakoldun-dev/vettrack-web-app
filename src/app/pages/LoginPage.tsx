import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Stethoscope, ShieldCheck, Crown, PawPrint, Code2,
  Eye, EyeOff, ArrowLeft, ChevronRight, Sun, Moon, UserPlus,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';

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

export default function LoginPage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const { signIn, signUp } = useAuth();
  const [selected, setSelected] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
      // Sign up flow
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) {
        setAuthError(error);
        return;
      }
      setSignUpSuccess(true);
      return;
    }

    // Sign in flow
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setAuthError(error);
      return;
    }
    // Navigation happens automatically via auth state change → App.tsx redirect
    if (selected === 'sysadmin') {
      navigate('/sysadmin');
    } else if (selected === 'superadmin') {
      navigate('/superadmin');
    } else if (selected === 'admin') {
      navigate('/admin');
    } else if (selected === 'patient') {
      navigate('/owner');
    } else {
      navigate('/');
    }
  }

  const pageBg = isDark
    ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F2A1A 100%)'
    : 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #ecfdf5 100%)';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: pageBg, padding: '24px', transition: 'background 0.3s' }}
    >
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

      {/* Ambient glow blobs */}
      <div
        style={{
          position: 'fixed', top: '10%', left: '15%',
          width: '420px', height: '420px',
          background: isDark
            ? 'radial-gradient(circle, color-mix(in srgb, var(--brand-green-text) 18%, transparent) 0%, transparent 70%)'
            : 'radial-gradient(circle, color-mix(in srgb, var(--brand-green-text) 12%, transparent) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'fixed', bottom: '15%', right: '10%',
          width: '340px', height: '340px',
          background: isDark
            ? 'radial-gradient(circle, rgba(116,198,157,0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(116,198,157,0.18) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          filter: 'blur(50px)',
        }}
      />

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
              }}
            >
              {ROLES.map(role => {
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
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${role.ring}, 0 8px 32px rgba(0,0,0,0.3)`;
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
      <p style={{ position: 'relative', zIndex: 1, marginTop: '40px', fontSize: '12px', color: isDark ? '#334155' : '#94A3B8' }}>
        © 2026 HugoIT · Secure veterinary management platform
      </p>
    </div>
  );
}
