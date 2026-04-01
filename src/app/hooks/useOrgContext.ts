import { supabase } from '../../lib/supabase';

export interface OrgContext {
  organizationId: string;
  clinicId: string;
}

// Cache the org context per auth user to avoid repeated staff lookups.
// Cleared on auth state change (sign-out / sign-in).
let _cache: OrgContext | null = null;
let _cacheUserId: string | null = null;

// Presence heartbeat: update user_sessions.last_active_at at most once per 5 min
let _lastHeartbeat = 0;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

async function firePresenceHeartbeat(userId: string) {
  const now = Date.now();
  if (now - _lastHeartbeat < HEARTBEAT_INTERVAL_MS) return;
  _lastHeartbeat = now;
  const ts = new Date().toISOString();
  // Update last_active_at on all sessions for this user
  const { count } = await supabase
    .from('user_sessions')
    .update({ last_active_at: ts })
    .eq('user_id', userId)
    .select('id', { count: 'exact', head: true });
  // If no session rows exist, insert a minimal presence row
  if (!count || count === 0) {
    supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        is_current: true,
        last_active_at: ts,
        session_token: crypto.randomUUID(),
        device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        browser: navigator.userAgent.includes('Chrome') ? 'Chrome'
          : navigator.userAgent.includes('Firefox') ? 'Firefox'
          : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other',
      })
      .then(() => {});
  }
}

/**
 * Fetch the current user's organization_id and clinic_id from the staff table.
 * Result is cached for the lifetime of the session (cleared on auth change).
 */
export async function getOrgContext(): Promise<OrgContext> {
  // Use getSession() (reads from local storage) instead of getUser() (network call).
  // getUser() can fail with "Failed to fetch" on flaky connections.
  // The AuthProvider already validates the session via onAuthStateChange.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) throw new Error('Not authenticated');

  // Return cached value if still the same user
  if (_cache && _cacheUserId === user.id) {
    firePresenceHeartbeat(user.id);
    return _cache;
  }

  const { data, error } = await supabase
    .from('staff')
    .select('organization_id, clinic_id')
    .eq('id', user.id)
    .single();

  if (error || !data) throw new Error('Failed to load org context: ' + (error?.message || 'no staff row'));

  _cache = {
    organizationId: data.organization_id,
    clinicId: data.clinic_id,
  };
  _cacheUserId = user.id;
  firePresenceHeartbeat(user.id);
  return _cache;
}

/** Clear the cache (call on sign-out). */
export function clearOrgContextCache() {
  _cache = null;
  _cacheUserId = null;
}
