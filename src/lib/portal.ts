/**
 * Portal session scoping utilities.
 *
 * Maps roles → portals, resolves portal from URL, validates portal access,
 * and manages server-side portal session state in `user_sessions`.
 */
import { supabase } from './supabase';

// ─── Portal types ─────────────────────────────────────────────
export type PortalId = 'doctor' | 'admin' | 'superadmin' | 'owner' | 'sysadmin';

// ─── Role → Portal mapping ───────────────────────────────────
const ROLE_PORTAL_MAP: Record<string, PortalId> = {
  veterinarian: 'doctor',
  senior_veterinarian: 'doctor',
  lead_vet_tech: 'doctor',
  specialist: 'doctor',
  front_desk_manager: 'admin',
  receptionist: 'admin',
  clinic_manager: 'admin',
  superadmin: 'superadmin',
  pet_owner: 'owner',
};

/** Get the portal a role is allowed to access. */
export function portalForRole(role: string): PortalId {
  return ROLE_PORTAL_MAP[role] || 'doctor';
}

// ─── URL → Portal mapping ────────────────────────────────────
const PATH_PORTAL_MAP: Array<{ prefix: string; portal: PortalId }> = [
  { prefix: '/sysadmin', portal: 'sysadmin' },
  { prefix: '/superadmin', portal: 'superadmin' },
  { prefix: '/admin', portal: 'admin' },
  { prefix: '/owner', portal: 'owner' },
];

/** Resolve which portal the current URL belongs to. */
export function portalFromPath(pathname: string): PortalId {
  for (const { prefix, portal } of PATH_PORTAL_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return portal;
    }
  }
  // Default root paths (/, /clients, /appointments, etc.) = doctor portal
  return 'doctor';
}

// ─── Portal access validation ────────────────────────────────

export interface PortalValidation {
  allowed: boolean;
  userPortal: PortalId;
  urlPortal: PortalId;
  redirectTo: string;
}

/**
 * Check whether a user's role grants access to the portal implied by `pathname`.
 * Returns the expected redirect path if access is denied.
 */
export function validatePortalAccess(role: string, pathname: string): PortalValidation {
  const userPortal = portalForRole(role);
  const urlPortal = portalFromPath(pathname);

  // Sysadmin is a special case — only superadmin can access it
  const allowed = urlPortal === 'sysadmin'
    ? role === 'superadmin'
    : urlPortal === userPortal;

  const redirectMap: Record<PortalId, string> = {
    doctor: '/',
    admin: '/admin',
    superadmin: '/superadmin',
    owner: '/owner',
    sysadmin: '/superadmin',
  };

  return {
    allowed,
    userPortal,
    urlPortal,
    redirectTo: redirectMap[userPortal],
  };
}

// ─── Server-side session portal tracking ─────────────────────

/**
 * Register or update the active portal in `user_sessions`.
 * Called on app load and portal navigation. This is the server-side source of truth
 * for which portal the user is currently on — not localStorage.
 */
export async function setSessionPortal(userId: string, portalId: PortalId): Promise<void> {
  // Update all current sessions for this user to the active portal
  const { count } = await supabase
    .from('user_sessions')
    .update({ portal_id: portalId, last_active_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_current', true)
    .select('id', { count: 'exact', head: true });

  // If no current session exists, create one
  if (!count || count === 0) {
    await supabase.from('user_sessions').insert({
      user_id: userId,
      portal_id: portalId,
      is_current: true,
      last_active_at: new Date().toISOString(),
      session_token: crypto.randomUUID(),
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      browser: navigator.userAgent.includes('Chrome') ? 'Chrome'
        : navigator.userAgent.includes('Firefox') ? 'Firefox'
        : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other',
    });
  }
}

/**
 * Get the server-side portal for the user's current session.
 * Returns null if no active session exists.
 */
export async function getSessionPortal(userId: string): Promise<PortalId | null> {
  const { data } = await supabase
    .from('user_sessions')
    .select('portal_id')
    .eq('user_id', userId)
    .eq('is_current', true)
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

  return (data?.portal_id as PortalId) || null;
}
