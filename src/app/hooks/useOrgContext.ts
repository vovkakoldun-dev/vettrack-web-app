import { supabase } from '../../lib/supabase';

export interface OrgContext {
  organizationId: string;
  clinicId: string;
}

/**
 * Fetch the current user's organization_id and clinic_id from the staff table.
 * Use this in event handlers (inserts/updates) instead of hardcoded UUIDs.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('staff')
    .select('organization_id, clinic_id')
    .eq('id', user.id)
    .single();

  if (error || !data) throw new Error('Failed to load org context: ' + (error?.message || 'no staff row'));

  return {
    organizationId: data.organization_id,
    clinicId: data.clinic_id,
  };
}
