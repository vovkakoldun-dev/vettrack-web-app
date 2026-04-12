-- ============================================================================
-- Migration: add_dashboard_stats_rpc
-- Date: 2026-04-11
--
-- Creates an RPC function that returns all dashboard statistics in a single
-- database round-trip, replacing 8 separate count queries.
--
-- Returns JSON:
--   {
--     "total_clients":          int,
--     "appointments_today":     int,
--     "vaccines_due_this_week": int,
--     "active_pets":            int,
--     "appointments_yesterday": int,
--     "clients_last_month":     int,
--     "pets_last_month":        int,
--     "vaccines_last_week":     int
--   }
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    -- 1. Total clients for the organisation
    'total_clients',
    (SELECT count(*)
       FROM clients
      WHERE organization_id = p_org_id),

    -- 2. Non-cancelled appointments scheduled today
    'appointments_today',
    (SELECT count(*)
       FROM appointments
      WHERE organization_id = p_org_id
        AND scheduled_at >= date_trunc('day', now())
        AND scheduled_at <  date_trunc('day', now()) + interval '1 day'
        AND status <> 'Cancelled'),

    -- 3. Vaccinations due within the next 7 days
    'vaccines_due_this_week',
    (SELECT count(*)
       FROM vaccinations v
      INNER JOIN pets p ON p.id = v.pet_id
      WHERE p.organization_id = p_org_id
        AND v.next_due_date <= (current_date + 7)),

    -- 4. Currently active pets
    'active_pets',
    (SELECT count(*)
       FROM pets
      WHERE organization_id = p_org_id
        AND is_active = true),

    -- 5. Non-cancelled appointments from yesterday
    'appointments_yesterday',
    (SELECT count(*)
       FROM appointments
      WHERE organization_id = p_org_id
        AND scheduled_at >= date_trunc('day', now()) - interval '1 day'
        AND scheduled_at <  date_trunc('day', now())
        AND status <> 'Cancelled'),

    -- 6. Clients that existed by end of last month
    'clients_last_month',
    (SELECT count(*)
       FROM clients
      WHERE organization_id = p_org_id
        AND created_at <= (date_trunc('month', now()) - interval '1 second')),

    -- 7. Active pets that existed by end of last month
    'pets_last_month',
    (SELECT count(*)
       FROM pets
      WHERE organization_id = p_org_id
        AND is_active = true
        AND created_at <= (date_trunc('month', now()) - interval '1 second')),

    -- 8. Vaccinations that were due up to 7 days ago (comparison baseline)
    'vaccines_last_week',
    (SELECT count(*)
       FROM vaccinations v
      INNER JOIN pets p ON p.id = v.pet_id
      WHERE p.organization_id = p_org_id
        AND v.next_due_date <= (current_date - 7))
  );
$$;

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION get_dashboard_stats(uuid) TO authenticated;

-- Add a comment for discoverability
COMMENT ON FUNCTION get_dashboard_stats(uuid) IS
  'Returns all dashboard statistics for a given organisation in a single call.';
