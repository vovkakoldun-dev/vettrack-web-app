import { supabase } from '../../lib/supabase';

export interface OrgContext {
  organizationId: string;
  clinicId: string;
}

// Cache the org context per auth user to avoid repeated staff lookups.
// Cleared on auth state change (sign-out / sign-in).
let _cache: OrgContext | null = null;
let _cacheUserId: string | null = null;
// In-flight promise — when many components call getOrgContext() at the
// same time on mount, they all share this single network round-trip
// instead of each hammering the staff table.
let _inflight: Promise<OrgContext> | null = null;

// Presence heartbeat: update user_sessions.last_active_at at most once per 5 min
let _lastHeartbeat = 0;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

// Stable session token per browser tab — prevents duplicate rows on each heartbeat
let _tabSessionToken: string | null = null;
function getTabSessionToken(): string {
  if (!_tabSessionToken) {
    // Reuse existing token from sessionStorage (survives page refresh, not new tabs)
    const stored = sessionStorage.getItem('vettrack_session_token');
    _tabSessionToken = stored || crypto.randomUUID();
    if (!stored) sessionStorage.setItem('vettrack_session_token', _tabSessionToken);
  }
  return _tabSessionToken;
}

async function firePresenceHeartbeat(userId: string) {
  const now = Date.now();
  if (now - _lastHeartbeat < HEARTBEAT_INTERVAL_MS) return;
  _lastHeartbeat = now;
  const ts = new Date().toISOString();
  const token = getTabSessionToken();
  const device = navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
  const browser = navigator.userAgent.includes('Chrome') ? 'Chrome'
    : navigator.userAgent.includes('Firefox') ? 'Firefox'
    : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other';

  // Upsert using stable token — updates if exists, inserts if first time
  await supabase
    .from('user_sessions')
    .upsert(
      {
        user_id: userId,
        session_token: token,
        is_current: true,
        last_active_at: ts,
        device,
        browser,
        location: 'Unknown',
      },
      { onConflict: 'session_token' }
    );
}

/**
 * Fetch the current user's organization_id and clinic_id.
 *
 * Tries the `staff` table first (covers doctors, admins, superadmins).
 * Falls back to the `profiles` table for non-staff users (e.g. pet owners)
 * who have an organization_id but no staff row.
 *
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
    // Fire heartbeat in background — don't await it
    firePresenceHeartbeat(user.id).catch(() => {});
    return _cache;
  }

  // If a fetch is already in flight for this user, ride along on it
  // instead of issuing a fresh staff lookup. This was the source of
  // 20+ duplicate `staff?id=eq.<user>` requests on every page load.
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      // Try staff table first (doctors, admins, superadmins)
      const { data: staffData } = await supabase
        .from('staff')
        .select('organization_id, clinic_id')
        .eq('id', user.id)
        .single();

      if (staffData) {
        _cache = {
          organizationId: staffData.organization_id,
          clinicId: staffData.clinic_id,
        };
        _cacheUserId = user.id;
        firePresenceHeartbeat(user.id);
        return _cache;
      }

      // Fallback: profiles table (pet owners and other non-staff users)
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileErr || !profileData?.organization_id) {
        throw new Error('Failed to load org context: no staff row or profile found');
      }

      _cache = {
        organizationId: profileData.organization_id,
        clinicId: '',
      };
      _cacheUserId = user.id;
      firePresenceHeartbeat(user.id);
      return _cache;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

/** Clear the cache (call on sign-out). */
export function clearOrgContextCache() {
  _cache = null;
  _cacheUserId = null;
  _inflight = null;
}
