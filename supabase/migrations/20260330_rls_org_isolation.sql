-- ============================================================================
-- ROW-LEVEL SECURITY — STRICT MULTI-TENANT ORG ISOLATION
-- ============================================================================
-- Replaces all wide-open "Allow all" / anon_all / auth_all policies with
-- proper org-scoped policies.
--
-- Every authenticated user can only access rows where:
--   organization_id = auth_org_id()
--
-- Helper function tries JWT claim first → profiles lookup fallback.
-- Anonymous users get zero access to org-scoped data.
-- service_role bypasses RLS by default (Supabase built-in).
--
-- PostgreSQL 17  ·  Supabase  ·  2026-03-30
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1 — Upgrade helper functions
-- ════════════════════════════════════════════════════════════════════════════

-- auth_org_id(): JWT claim first, profiles fallback
-- SECURITY DEFINER so it can read profiles even if the caller's policies
-- haven't resolved yet. STABLE lets the planner cache within a statement.
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'organization_id')::uuid,
    (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
$$;

-- auth_role(): same upgrade pattern
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_role')::user_role,
    (SELECT role FROM profiles WHERE id = auth.uid())
  )
$$;

-- is_clinic_staff(): unchanged logic, just ensure it uses upgraded auth_role()
CREATE OR REPLACE FUNCTION is_clinic_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_role() IN (
    'superadmin','clinic_manager','veterinarian','senior_veterinarian',
    'lead_vet_tech','vet_technician','front_desk_manager','receptionist',
    'groomer','lab_technician','specialist'
  )
$$;

-- is_admin_or_above(): convenience for write policies
CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_role() IN ('superadmin', 'clinic_manager', 'owner')
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2 — Drop ALL existing wide-open and legacy policies
-- ════════════════════════════════════════════════════════════════════════════
-- This is the critical cleanup. Every "anon_all_*", "auth_all_*", and
-- "Allow all *" policy is a security hole that bypasses org isolation.

DO $drop_policies$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        -- Wide-open policies
        policyname LIKE 'anon_all_%'
        OR policyname LIKE 'auth_all_%'
        OR policyname LIKE 'Allow all%'
        -- Legacy org-scoped policies we're replacing
        OR policyname LIKE 'appts:%'
        OR policyname LIKE 'clients:%'
        OR policyname LIKE 'clinics:%'
        OR policyname LIKE 'invoices:%'
        OR policyname LIKE 'messages:%'
        OR policyname LIKE 'notifications:%'
        OR policyname LIKE 'pets:%'
        OR policyname LIKE 'profiles:%'
        OR policyname LIKE 'records:%'
        OR policyname LIKE 'services:%'
        OR policyname LIKE 'staff:%'
        OR policyname LIKE 'audit:%'
        OR policyname LIKE 'orgs:%'
        -- pet_notes legacy
        OR policyname LIKE 'Allow authors%'
        OR policyname LIKE 'Allow org members%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$drop_policies$;


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3 — Create strict org-scoped policies
-- ════════════════════════════════════════════════════════════════════════════
-- Pattern per table:
--   SELECT  → authenticated, organization_id = auth_org_id()
--   INSERT  → authenticated, WITH CHECK organization_id = auth_org_id()
--   UPDATE  → authenticated, organization_id = auth_org_id()
--   DELETE  → authenticated, organization_id = auth_org_id()
--
-- Tables with elevated write restrictions get an additional admin check.


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  ORGANIZATIONS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "org_select"
  ON organizations FOR SELECT
  TO authenticated
  USING (id = auth_org_id());

CREATE POLICY "org_update"
  ON organizations FOR UPDATE
  TO authenticated
  USING (id = auth_org_id() AND auth_role() IN ('superadmin', 'owner'));


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PROFILES
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CLINICS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "clinics_select"
  ON clinics FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "clinics_insert"
  ON clinics FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "clinics_update"
  ON clinics FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "clinics_delete"
  ON clinics FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'superadmin');


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  STAFF
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "staff_select"
  ON staff FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "staff_insert"
  ON staff FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "staff_update"
  ON staff FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "staff_delete"
  ON staff FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'superadmin');


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CLIENTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "clients_select"
  ON clients FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "clients_insert"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "clients_update"
  ON clients FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "clients_delete"
  ON clients FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PETS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "pets_select"
  ON pets FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "pets_insert"
  ON pets FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "pets_update"
  ON pets FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "pets_delete"
  ON pets FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  APPOINTMENTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "appointments_select"
  ON appointments FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "appointments_delete"
  ON appointments FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  MEDICAL_RECORDS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "medical_records_select"
  ON medical_records FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "medical_records_insert"
  ON medical_records FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "medical_records_update"
  ON medical_records FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "medical_records_delete"
  ON medical_records FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  LAB_RESULTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "lab_results_select"
  ON lab_results FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "lab_results_insert"
  ON lab_results FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "lab_results_update"
  ON lab_results FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "lab_results_delete"
  ON lab_results FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  MEDICATIONS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "medications_select"
  ON medications FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "medications_insert"
  ON medications FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "medications_update"
  ON medications FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "medications_delete"
  ON medications FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  VACCINATIONS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "vaccinations_select"
  ON vaccinations FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "vaccinations_insert"
  ON vaccinations FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "vaccinations_update"
  ON vaccinations FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "vaccinations_delete"
  ON vaccinations FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  INVOICES
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "invoices_select"
  ON invoices FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  SERVICES
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "services_select"
  ON services FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "services_insert"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "services_update"
  ON services FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "services_delete"
  ON services FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'superadmin');


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  TASKS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "tasks_delete"
  ON tasks FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  SHIFTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "shifts_select"
  ON shifts FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "shifts_insert"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "shifts_update"
  ON shifts FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "shifts_delete"
  ON shifts FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  STAFF_TIME_BLOCKS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "staff_time_blocks_select"
  ON staff_time_blocks FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "staff_time_blocks_insert"
  ON staff_time_blocks FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "staff_time_blocks_update"
  ON staff_time_blocks FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "staff_time_blocks_delete"
  ON staff_time_blocks FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CONVERSATIONS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "conversations_select"
  ON conversations FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "conversations_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "conversations_update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "conversations_delete"
  ON conversations FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CONVERSATION_PARTICIPANTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "conversation_participants_select"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "conversation_participants_insert"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "conversation_participants_update"
  ON conversation_participants FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "conversation_participants_delete"
  ON conversation_participants FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  MESSAGES
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "messages_select"
  ON messages FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "messages_update"
  ON messages FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND sender_id = auth.uid());

CREATE POLICY "messages_delete"
  ON messages FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND sender_id = auth.uid());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CHAT_MESSAGES (legacy/simple chat)
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "chat_messages_select"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "chat_messages_insert"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "chat_messages_update"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "chat_messages_delete"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  NOTIFICATIONS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id() AND profile_id = auth.uid());

CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND profile_id = auth.uid());

CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND profile_id = auth.uid());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  NOTIFICATION_EVENTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "notification_events_select"
  ON notification_events FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "notification_events_insert"
  ON notification_events FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "notification_events_update"
  ON notification_events FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "notification_events_delete"
  ON notification_events FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  NOTIFICATION_STATE
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "notification_state_select"
  ON notification_state FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "notification_state_insert"
  ON notification_state FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "notification_state_update"
  ON notification_state FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PET_NOTES
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "pet_notes_select"
  ON pet_notes FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "pet_notes_insert"
  ON pet_notes FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "pet_notes_update"
  ON pet_notes FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND author_id = auth.uid());

CREATE POLICY "pet_notes_delete"
  ON pet_notes FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND author_id = auth.uid());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  VISIT_REPORTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "visit_reports_select"
  ON visit_reports FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "visit_reports_insert"
  ON visit_reports FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "visit_reports_update"
  ON visit_reports FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "visit_reports_delete"
  ON visit_reports FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  AUDIT_LOGS (read-only for non-superadmins, append-only)
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

-- No UPDATE or DELETE — audit logs are immutable


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  ORGANIZATION_SETTINGS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "org_settings_select"
  ON organization_settings FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "org_settings_insert"
  ON organization_settings FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "org_settings_update"
  ON organization_settings FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "org_settings_delete"
  ON organization_settings FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'superadmin');


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  ORGANIZATION_BILLING
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "org_billing_select"
  ON organization_billing FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());

CREATE POLICY "org_billing_update"
  ON organization_billing FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'superadmin');


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PLATFORM_INVOICES
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "platform_invoices_select"
  ON platform_invoices FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PENDING_REQUESTS
-- └──────────────────────────────────────────────────────────────────────────

CREATE POLICY "pending_requests_select"
  ON pending_requests FOR SELECT
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "pending_requests_insert"
  ON pending_requests FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "pending_requests_update"
  ON pending_requests FOR UPDATE
  TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "pending_requests_delete"
  ON pending_requests FOR DELETE
  TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 4 — Ensure RLS is enabled on ALL org-scoped tables
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotent — harmless if already enabled.

ALTER TABLE organizations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results               ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE services                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_time_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_state        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_notes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_billing      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_requests          ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 5 — Performance index for auth_org_id() profile lookup fallback
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_id_org
  ON profiles(id, organization_id);


-- ════════════════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════════════════
-- To add organization_id as a JWT claim (recommended for performance),
-- create a Supabase Auth Hook or set it in raw_app_meta_data:
--
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
--     'organization_id', (SELECT organization_id FROM profiles WHERE id = auth.users.id)
--   )
--   WHERE id = '<user_id>';
--
-- The auth_org_id() function will automatically use the JWT claim when
-- available and fall back to the profiles lookup if not.

COMMIT;
