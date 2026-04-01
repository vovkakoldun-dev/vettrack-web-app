-- ============================================================================
-- MULTI-TENANT COMPOSITE FOREIGN KEY MIGRATION
-- ============================================================================
-- Enforces strict org-level isolation at the DB level by ensuring every FK
-- that crosses org-scoped tables includes organization_id in the reference.
--
-- Pattern: FK (entity_id, organization_id) → parent(id, organization_id)
-- This makes it impossible for a row in Org-A to reference a row in Org-B.
--
-- PostgreSQL 17  ·  Supabase  ·  2026-03-30
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1 — Add organization_id to tables that are missing it
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE lab_results     ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE medications     ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE vaccinations    ADD COLUMN IF NOT EXISTS organization_id uuid;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2 — Backfill organization_id from related tables
-- ════════════════════════════════════════════════════════════════════════════

-- medical_records → derive from pets (all 8 rows have pet_id)
UPDATE medical_records mr
SET    organization_id = p.organization_id
FROM   pets p
WHERE  mr.pet_id = p.id
  AND  mr.organization_id IS NULL;

-- lab_results → derive from pets
UPDATE lab_results lr
SET    organization_id = p.organization_id
FROM   pets p
WHERE  lr.pet_id = p.id
  AND  lr.organization_id IS NULL;

-- medications → derive from pets (0 rows currently, but future-proof)
UPDATE medications m
SET    organization_id = p.organization_id
FROM   pets p
WHERE  m.pet_id = p.id
  AND  m.organization_id IS NULL;

-- vaccinations → derive from pets
UPDATE vaccinations v
SET    organization_id = p.organization_id
FROM   pets p
WHERE  v.pet_id = p.id
  AND  v.organization_id IS NULL;

-- Fallback: any remaining NULLs via clinic
UPDATE medical_records mr
SET    organization_id = c.organization_id
FROM   clinics c
WHERE  mr.clinic_id = c.id
  AND  mr.organization_id IS NULL;

UPDATE lab_results lr
SET    organization_id = c.organization_id
FROM   clinics c
WHERE  lr.clinic_id = c.id
  AND  lr.organization_id IS NULL;

UPDATE vaccinations v
SET    organization_id = c.organization_id
FROM   clinics c
WHERE  v.clinic_id = c.id
  AND  v.organization_id IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3 — Set NOT NULL + FK to organizations for new columns
-- ════════════════════════════════════════════════════════════════════════════

-- Default to the single org for any stragglers, then enforce NOT NULL
UPDATE medical_records SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE lab_results     SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE medications     SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE vaccinations    SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

ALTER TABLE medical_records ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE medical_records ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE lab_results ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE lab_results ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE medications ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE medications ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE vaccinations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE vaccinations ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- FK to organizations
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE lab_results
  ADD CONSTRAINT lab_results_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE medications
  ADD CONSTRAINT medications_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE vaccinations
  ADD CONSTRAINT vaccinations_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 4 — Add UNIQUE(id, organization_id) on every parent table
-- ════════════════════════════════════════════════════════════════════════════
-- These are required for composite FKs to reference (id, organization_id).

ALTER TABLE clinics          ADD CONSTRAINT uq_clinics_id_org          UNIQUE (id, organization_id);
ALTER TABLE profiles         ADD CONSTRAINT uq_profiles_id_org         UNIQUE (id, organization_id);
ALTER TABLE staff            ADD CONSTRAINT uq_staff_id_org            UNIQUE (id, organization_id);
ALTER TABLE clients          ADD CONSTRAINT uq_clients_id_org          UNIQUE (id, organization_id);
ALTER TABLE pets             ADD CONSTRAINT uq_pets_id_org             UNIQUE (id, organization_id);
ALTER TABLE appointments     ADD CONSTRAINT uq_appointments_id_org     UNIQUE (id, organization_id);
ALTER TABLE services         ADD CONSTRAINT uq_services_id_org         UNIQUE (id, organization_id);
ALTER TABLE medical_records  ADD CONSTRAINT uq_medical_records_id_org  UNIQUE (id, organization_id);
ALTER TABLE conversations    ADD CONSTRAINT uq_conversations_id_org    UNIQUE (id, organization_id);
ALTER TABLE tasks            ADD CONSTRAINT uq_tasks_id_org            UNIQUE (id, organization_id);
ALTER TABLE shifts           ADD CONSTRAINT uq_shifts_id_org           UNIQUE (id, organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 5 — Drop old single-column FKs + Add composite FKs
-- ════════════════════════════════════════════════════════════════════════════
-- For ON DELETE SET NULL, PG17 column-specific syntax ensures only the
-- entity column is nullified, never organization_id.
--
-- For ON DELETE CASCADE, the child row is deleted (same behavior as before).
-- For ON DELETE NO ACTION, deletion of parent is blocked if children exist.


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  STAFF
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE staff DROP CONSTRAINT staff_clinic_id_fkey;
ALTER TABLE staff
  ADD CONSTRAINT staff_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE CASCADE;

ALTER TABLE staff DROP CONSTRAINT staff_profile_id_fkey;
ALTER TABLE staff
  ADD CONSTRAINT staff_profile_id_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE SET NULL (profile_id);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CLIENTS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE clients DROP CONSTRAINT clients_clinic_id_fkey;
ALTER TABLE clients
  ADD CONSTRAINT clients_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE SET NULL (clinic_id);

ALTER TABLE clients DROP CONSTRAINT clients_profile_id_fkey;
ALTER TABLE clients
  ADD CONSTRAINT clients_profile_id_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE SET NULL (profile_id);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PETS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE pets DROP CONSTRAINT pets_client_id_fkey;
ALTER TABLE pets
  ADD CONSTRAINT pets_client_id_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id) ON DELETE CASCADE;

ALTER TABLE pets DROP CONSTRAINT pets_clinic_id_fkey;
ALTER TABLE pets
  ADD CONSTRAINT pets_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE SET NULL (clinic_id);

ALTER TABLE pets DROP CONSTRAINT pets_assigned_vet_id_fkey;
ALTER TABLE pets
  ADD CONSTRAINT pets_assigned_vet_id_org_fkey
  FOREIGN KEY (assigned_vet_id, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (assigned_vet_id);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  APPOINTMENTS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE appointments DROP CONSTRAINT appointments_client_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_client_id_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT appointments_clinic_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT appointments_pet_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT appointments_vet_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_vet_id_org_fkey
  FOREIGN KEY (vet_id, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (vet_id);

ALTER TABLE appointments DROP CONSTRAINT appointments_created_by_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (created_by);

ALTER TABLE appointments DROP CONSTRAINT appointments_service_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_service_id_org_fkey
  FOREIGN KEY (service_id, organization_id) REFERENCES services(id, organization_id) ON DELETE SET NULL (service_id);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  MEDICAL_RECORDS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE medical_records DROP CONSTRAINT medical_records_pet_id_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE medical_records DROP CONSTRAINT medical_records_client_id_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_client_id_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id) ON DELETE CASCADE;

ALTER TABLE medical_records DROP CONSTRAINT medical_records_clinic_id_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE CASCADE;

ALTER TABLE medical_records DROP CONSTRAINT medical_records_appointment_id_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_appointment_id_org_fkey
  FOREIGN KEY (appointment_id, organization_id) REFERENCES appointments(id, organization_id) ON DELETE SET NULL (appointment_id);

ALTER TABLE medical_records DROP CONSTRAINT medical_records_vet_id_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_vet_id_org_fkey
  FOREIGN KEY (vet_id, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (vet_id);

ALTER TABLE medical_records DROP CONSTRAINT medical_records_created_by_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (created_by);

ALTER TABLE medical_records DROP CONSTRAINT medical_records_amended_by_fkey;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_amended_by_org_fkey
  FOREIGN KEY (amended_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (amended_by);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  LAB_RESULTS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE lab_results DROP CONSTRAINT lab_results_pet_id_fkey;
ALTER TABLE lab_results
  ADD CONSTRAINT lab_results_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE lab_results DROP CONSTRAINT lab_results_clinic_id_fkey;
ALTER TABLE lab_results
  ADD CONSTRAINT lab_results_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE CASCADE;

ALTER TABLE lab_results DROP CONSTRAINT lab_results_record_id_fkey;
ALTER TABLE lab_results
  ADD CONSTRAINT lab_results_record_id_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records(id, organization_id) ON DELETE SET NULL (record_id);

ALTER TABLE lab_results DROP CONSTRAINT lab_results_ordered_by_fkey;
ALTER TABLE lab_results
  ADD CONSTRAINT lab_results_ordered_by_org_fkey
  FOREIGN KEY (ordered_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (ordered_by);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  MEDICATIONS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE medications DROP CONSTRAINT medications_pet_id_fkey;
ALTER TABLE medications
  ADD CONSTRAINT medications_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE medications DROP CONSTRAINT medications_record_id_fkey;
ALTER TABLE medications
  ADD CONSTRAINT medications_record_id_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records(id, organization_id) ON DELETE CASCADE;

ALTER TABLE medications DROP CONSTRAINT medications_prescribed_by_fkey;
ALTER TABLE medications
  ADD CONSTRAINT medications_prescribed_by_org_fkey
  FOREIGN KEY (prescribed_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (prescribed_by);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  VACCINATIONS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE vaccinations DROP CONSTRAINT vaccinations_pet_id_fkey;
ALTER TABLE vaccinations
  ADD CONSTRAINT vaccinations_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE vaccinations DROP CONSTRAINT vaccinations_clinic_id_fkey;
ALTER TABLE vaccinations
  ADD CONSTRAINT vaccinations_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE SET NULL (clinic_id);

ALTER TABLE vaccinations DROP CONSTRAINT vaccinations_record_id_fkey;
ALTER TABLE vaccinations
  ADD CONSTRAINT vaccinations_record_id_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records(id, organization_id) ON DELETE SET NULL (record_id);

ALTER TABLE vaccinations DROP CONSTRAINT vaccinations_administered_by_fkey;
ALTER TABLE vaccinations
  ADD CONSTRAINT vaccinations_administered_by_org_fkey
  FOREIGN KEY (administered_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (administered_by);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  INVOICES
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE invoices DROP CONSTRAINT invoices_client_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_client_id_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT invoices_clinic_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT invoices_appointment_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_appointment_id_org_fkey
  FOREIGN KEY (appointment_id, organization_id) REFERENCES appointments(id, organization_id) ON DELETE SET NULL (appointment_id);

ALTER TABLE invoices DROP CONSTRAINT invoices_record_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_record_id_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records(id, organization_id) ON DELETE SET NULL (record_id);

ALTER TABLE invoices DROP CONSTRAINT invoices_created_by_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES staff(id, organization_id) ON DELETE SET NULL (created_by);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  TASKS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE tasks DROP CONSTRAINT tasks_client_id_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_client_id_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id) ON DELETE SET NULL (client_id);

ALTER TABLE tasks DROP CONSTRAINT tasks_pet_id_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE SET NULL (pet_id);

ALTER TABLE tasks DROP CONSTRAINT tasks_assigned_by_id_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_by_id_org_fkey
  FOREIGN KEY (assigned_by_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE SET NULL (assigned_by_id);

ALTER TABLE tasks DROP CONSTRAINT tasks_assigned_to_id_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_to_id_org_fkey
  FOREIGN KEY (assigned_to_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE SET NULL (assigned_to_id);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  SHIFTS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE shifts DROP CONSTRAINT shifts_staff_id_fkey;
ALTER TABLE shifts
  ADD CONSTRAINT shifts_staff_id_org_fkey
  FOREIGN KEY (staff_id, organization_id) REFERENCES staff(id, organization_id) ON DELETE NO ACTION;

ALTER TABLE shifts DROP CONSTRAINT shifts_swap_with_staff_id_fkey;
ALTER TABLE shifts
  ADD CONSTRAINT shifts_swap_with_staff_id_org_fkey
  FOREIGN KEY (swap_with_staff_id, organization_id) REFERENCES staff(id, organization_id) ON DELETE NO ACTION;


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  STAFF_TIME_BLOCKS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE staff_time_blocks DROP CONSTRAINT staff_time_blocks_staff_id_fkey;
ALTER TABLE staff_time_blocks
  ADD CONSTRAINT staff_time_blocks_staff_id_org_fkey
  FOREIGN KEY (staff_id, organization_id) REFERENCES staff(id, organization_id) ON DELETE NO ACTION;

ALTER TABLE staff_time_blocks DROP CONSTRAINT staff_time_blocks_clinic_id_fkey;
ALTER TABLE staff_time_blocks
  ADD CONSTRAINT staff_time_blocks_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE SET NULL (clinic_id);


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  PET_NOTES
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE pet_notes DROP CONSTRAINT pet_notes_pet_id_fkey;
ALTER TABLE pet_notes
  ADD CONSTRAINT pet_notes_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE pet_notes DROP CONSTRAINT pet_notes_author_id_fkey;
ALTER TABLE pet_notes
  ADD CONSTRAINT pet_notes_author_id_org_fkey
  FOREIGN KEY (author_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE NO ACTION;


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  VISIT_REPORTS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE visit_reports DROP CONSTRAINT visit_reports_appointment_id_fkey;
ALTER TABLE visit_reports
  ADD CONSTRAINT visit_reports_appointment_id_org_fkey
  FOREIGN KEY (appointment_id, organization_id) REFERENCES appointments(id, organization_id) ON DELETE SET NULL (appointment_id);

ALTER TABLE visit_reports DROP CONSTRAINT visit_reports_pet_id_fkey;
ALTER TABLE visit_reports
  ADD CONSTRAINT visit_reports_pet_id_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets(id, organization_id) ON DELETE CASCADE;

ALTER TABLE visit_reports DROP CONSTRAINT visit_reports_vet_id_fkey;
ALTER TABLE visit_reports
  ADD CONSTRAINT visit_reports_vet_id_org_fkey
  FOREIGN KEY (vet_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE NO ACTION;


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  CONVERSATION_PARTICIPANTS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_conversation_id_fkey;
ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_conversation_id_org_fkey
  FOREIGN KEY (conversation_id, organization_id) REFERENCES conversations(id, organization_id) ON DELETE CASCADE;

ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_profile_id_fkey;
ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_profile_id_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE CASCADE;


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  MESSAGES
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE messages DROP CONSTRAINT messages_conversation_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_conversation_id_org_fkey
  FOREIGN KEY (conversation_id, organization_id) REFERENCES conversations(id, organization_id) ON DELETE CASCADE;

ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_org_fkey
  FOREIGN KEY (sender_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE CASCADE;

-- messages.reply_to_id is a self-reference — kept as single-column FK (same table = same org guaranteed)


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  NOTIFICATIONS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT notifications_profile_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_profile_id_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE CASCADE;


-- ┌──────────────────────────────────────────────────────────────────────────
-- │  AUDIT_LOGS
-- └──────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_actor_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_id_org_fkey
  FOREIGN KEY (actor_id, organization_id) REFERENCES profiles(id, organization_id) ON DELETE SET NULL (actor_id);

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_clinic_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_clinic_id_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics(id, organization_id) ON DELETE SET NULL (clinic_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 6 — Enable RLS on newly org-scoped tables
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations    ENABLE ROW LEVEL SECURITY;

-- Open policies (tighten per your auth model later)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medical_records' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON medical_records FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lab_results' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON lab_results FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medications' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON medications FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vaccinations' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON vaccinations FOR ALL USING (true);
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 7 — Indexes for composite FK performance
-- ════════════════════════════════════════════════════════════════════════════
-- Composite FKs benefit from matching indexes on the child side.

CREATE INDEX IF NOT EXISTS idx_staff_clinic_org         ON staff(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_profile_org        ON staff(profile_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_clinic_org       ON clients(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_profile_org      ON clients(profile_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_pets_client_org          ON pets(client_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_pets_clinic_org          ON pets(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_pets_assigned_vet_org    ON pets(assigned_vet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_appts_client_org         ON appointments(client_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_appts_clinic_org         ON appointments(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_appts_pet_org            ON appointments(pet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_appts_vet_org            ON appointments(vet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_appts_service_org        ON appointments(service_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_medrec_pet_org           ON medical_records(pet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_medrec_client_org        ON medical_records(client_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_medrec_clinic_org        ON medical_records(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_medrec_appt_org          ON medical_records(appointment_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_medrec_vet_org           ON medical_records(vet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_pet_org              ON lab_results(pet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_clinic_org           ON lab_results(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_record_org           ON lab_results(record_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_meds_pet_org             ON medications(pet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_meds_record_org          ON medications(record_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_vax_pet_org              ON vaccinations(pet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_vax_clinic_org           ON vaccinations(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_vax_record_org           ON vaccinations(record_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_org      ON invoices(client_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_org      ON invoices(clinic_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_appt_org        ON invoices(appointment_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_record_org      ON invoices(record_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_org         ON tasks(client_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_pet_org            ON tasks(pet_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_org         ON shifts(staff_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_rpt_appt_org       ON visit_reports(appointment_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_rpt_pet_org        ON visit_reports(pet_id, organization_id);

COMMIT;
