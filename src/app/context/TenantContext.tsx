/**
 * TenantContext — React context that enforces tenant isolation on every request.
 *
 * Responsibilities:
 * 1. Extract organization_id, clinic_id, role from the authenticated session.
 * 2. Reject rendering if the tenant identity is missing or invalid.
 * 3. Strip organization_id / portal_id from URL params on every navigation.
 * 4. Provide a `tenantDb` (TenantClient) that auto-injects org_id on every query.
 * 5. Log any mismatch / override attempt as a security event.
 * 6. Detect mid-session org changes and force logout.
 * 7. Periodic integrity check — re-validates org every 60s.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import {
  createTenantClient,
  guardUrlParams,
  logSecurityEvent,
  type TenantClient,
  type TenantIdentity,
} from '../../lib/tenant';
import { useAuth } from './AuthContext';

// ─── Context shape ────────────────────────────────────────────
interface TenantContextValue {
  /** Validated tenant identity (org, clinic, user, role). */
  identity: TenantIdentity | null;
  /** Tenant-scoped Supabase client — use this instead of raw `supabase`. */
  tenantDb: TenantClient | null;
  /** True while loading the tenant identity from the DB. */
  loading: boolean;
  /** Non-null when the tenant identity could not be resolved. */
  error: string | null;
}

const TenantContext = createContext<TenantContextValue>({
  identity: null,
  tenantDb: null,
  loading: true,
  error: null,
});

// ─── Provider ─────────────────────────────────────────────────
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<TenantIdentity | null>(null);
  const [tenantDb, setTenantDb] = useState<TenantClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedUserRef = useRef<string | null>(null);
  const resolvedOrgRef = useRef<string | null>(null);

  // ── Resolve identity from the database (not from frontend state) ──
  const resolveIdentity = useCallback(async (userId: string) => {
    try {
      // Fetch profile + staff in parallel (profile is source of truth, staff has clinic_id)
      const [profileResult, staffResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('organization_id, role')
          .eq('id', userId)
          .single(),
        supabase
          .from('staff')
          .select('clinic_id')
          .eq('id', userId)
          .single(),
      ]);

      const { data: profile, error: profileErr } = profileResult;
      const { data: staff } = staffResult;

      if (profileErr || !profile?.organization_id) {
        const msg = 'Tenant identity resolution failed: no profile found';
        setError(msg);
        setLoading(false);
        logSecurityEvent(null, 'IDENTITY_MISSING', `User ${userId}: ${profileErr?.message || 'no org_id'}`);
        return;
      }

      // ── Org mismatch detection: if user's org changed mid-session, force logout ──
      if (resolvedOrgRef.current && resolvedOrgRef.current !== profile.organization_id) {
        logSecurityEvent(
          { organizationId: profile.organization_id, clinicId: '', userId, role: profile.role || '' },
          'TENANT_VIOLATION',
          `Org changed mid-session: ${resolvedOrgRef.current} → ${profile.organization_id}. Forcing logout.`,
        );
        resolvedOrgRef.current = null;
        resolvedUserRef.current = null;
        setIdentity(null);
        setTenantDb(null);
        await signOut();
        navigate('/login', { replace: true });
        return;
      }

      const ident: TenantIdentity = {
        organizationId: profile.organization_id,
        clinicId: staff?.clinic_id || '',
        userId,
        role: profile.role || '',
      };

      setIdentity(ident);
      setTenantDb(createTenantClient(ident));
      setError(null);
      setLoading(false);
      resolvedUserRef.current = userId;
      resolvedOrgRef.current = profile.organization_id;
    } catch (e: any) {
      setError('Tenant resolution error: ' + (e.message || 'unknown'));
      setLoading(false);
    }
  }, [signOut, navigate]);

  // ── Re-resolve when user changes ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setIdentity(null);
      setTenantDb(null);
      setLoading(false);
      setError(null);
      resolvedUserRef.current = null;
      resolvedOrgRef.current = null;
      return;
    }
    // Only re-resolve if the user changed
    if (resolvedUserRef.current === user.id) return;
    setLoading(true);
    resolveIdentity(user.id);
  }, [user, resolveIdentity]);

  // ── Guard URL params on every navigation ──────────────────────
  useEffect(() => {
    guardUrlParams(identity);
  }, [location, identity]);

  // ── Periodic org integrity check (every 60s) ─────────────────
  // Re-fetches the user's org from profiles and forces logout if it changed.
  // Catches server-side org reassignment while the session is active.
  useEffect(() => {
    if (!user || !identity) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        if (data && data.organization_id !== identity.organizationId) {
          logSecurityEvent(identity, 'TENANT_VIOLATION',
            `Periodic check: org changed ${identity.organizationId} → ${data.organization_id}. Forcing logout.`);
          await signOut();
          navigate('/login', { replace: true });
        }
      } catch {
        // Network errors are non-fatal — skip this check cycle
      }
    }, 300_000); // Check every 5 min (was 60s — too aggressive)
    return () => clearInterval(interval);
  }, [user, identity, signOut, navigate]);

  return (
    <TenantContext.Provider value={{ identity, tenantDb, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────

/** Access the tenant context. */
export function useTenant() {
  return useContext(TenantContext);
}

/**
 * Get the tenant-scoped DB client. Throws if tenant is not resolved yet.
 * Use this in components that are guaranteed to render only when authenticated.
 */
export function useTenantDb(): TenantClient {
  const { tenantDb } = useContext(TenantContext);
  if (!tenantDb) {
    throw new Error('useTenantDb() called before tenant identity was resolved. Ensure the component is wrapped in <TenantProvider> and the user is authenticated.');
  }
  return tenantDb;
}

/**
 * Gate component — renders children only when tenant identity is valid.
 * Shows a blocking screen if identity is missing or invalid.
 */
export function TenantGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { identity, loading, error } = useTenant();

  if (loading) {
    return fallback ? <>{fallback}</> : null;
  }

  if (error || !identity) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--text-primary, #333)',
        backgroundColor: 'var(--bg-offwhite, #f9fafb)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Access Denied</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary, #666)', maxWidth: 400, textAlign: 'center' }}>
          {error || 'Unable to verify your organization. Please sign out and try again.'}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
