/**
 * TenantContext — React context that enforces tenant isolation on every request.
 *
 * Responsibilities:
 * 1. Extract organization_id, clinic_id, role from the authenticated session.
 * 2. Reject rendering if the tenant identity is missing or invalid.
 * 3. Strip organization_id / portal_id from URL params on every navigation.
 * 4. Provide a `tenantDb` (TenantClient) that auto-injects org_id on every query.
 * 5. Log any mismatch / override attempt as a security event.
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
import { useLocation } from 'react-router';
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

// ─── Provider ────────���────────────────────────────────────────
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [identity, setIdentity] = useState<TenantIdentity | null>(null);
  const [tenantDb, setTenantDb] = useState<TenantClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedUserRef = useRef<string | null>(null);

  // ── Resolve identity from the database (not from frontend state) ──
  const resolveIdentity = useCallback(async (userId: string) => {
    try {
      // Fetch from profiles (the identity source of truth, per multi-tenant rules)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', userId)
        .single();

      if (profileErr || !profile?.organization_id) {
        const msg = 'Tenant identity resolution failed: no profile found';
        setError(msg);
        setLoading(false);
        logSecurityEvent(null, 'IDENTITY_MISSING', `User ${userId}: ${profileErr?.message || 'no org_id'}`);
        return;
      }

      // Fetch clinic_id from staff table
      const { data: staff } = await supabase
        .from('staff')
        .select('clinic_id')
        .eq('id', userId)
        .single();

      const ident: TenantIdentity = {
        organizationId: profile.organization_id,
        clinicId: staff?.clinic_id || '',
        userId,
        role: profile.role || '',
      };

      // Validate organization exists
      const { count } = await supabase
        .from('organizations')
        .select('id', { count: 'exact', head: true })
        .eq('id', ident.organizationId);

      if (!count || count === 0) {
        const msg = 'Invalid organization_id in profile';
        setError(msg);
        logSecurityEvent(ident, 'INVALID_ORG', `org_id ${ident.organizationId} does not exist`);
        setLoading(false);
        return;
      }

      setIdentity(ident);
      setTenantDb(createTenantClient(ident));
      setError(null);
      setLoading(false);
      resolvedUserRef.current = userId;
    } catch (e: any) {
      setError('Tenant resolution error: ' + (e.message || 'unknown'));
      setLoading(false);
    }
  }, []);

  // ── Re-resolve when user changes ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setIdentity(null);
      setTenantDb(null);
      setLoading(false);
      setError(null);
      resolvedUserRef.current = null;
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

  return (
    <TenantContext.Provider value={{ identity, tenantDb, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

// ─── Hooks ────────────���───────────────────────────────────────

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
