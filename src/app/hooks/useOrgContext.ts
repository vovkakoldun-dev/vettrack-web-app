import { supabase } from '../../lib/supabase';

export interface OrgContext {
  organizationId: string;
  clinicId: string;
}

// Cache the org context per auth user to avoid repeated staff lookups.
// Cleared on auth state change (sign-out / sign-in).
let _cache: OrgContext | null = null;
let _cacheUserId: string | null = null;

/**
 * Fetch the current user's organization_id and clinic_id from the staff table.
 * Result is cached for the lifetime of the session (cleared on auth change).
 */
export async function getOrgContext(): Promise<OrgContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Return cached value if still the same user
  if (_cache && _cacheUserId === user.id) return _cache;

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
  return _cache;
}

/** Clear the cache (call on sign-out). */
export function clearOrgContextCache() {
  _cache = null;
  _cacheUserId = null;
}
