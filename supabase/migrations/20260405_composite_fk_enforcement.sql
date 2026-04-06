-- ============================================================================
-- MIGRATION: Composite FK Enforcement — Full Multi-Tenant Isolation
-- Date:      2026-04-05
-- Purpose:   Convert ALL single-column FKs that reference org-scoped parent
--            tables into composite FKs (entity_id, organization_id) so it
--            becomes IMPOSSIBLE at the database level to link records across
--            organizations. Also adds organization_id to the 7 remaining
--            child tables that lack it.
--
-- Sections:
--   1. UNIQUE(id, organization_id) indexes on parent tables (prerequisite)
--   2. Add organization_id to 7 remaining tables + backfill + RLS
--   3. Upgrade all single-column FKs to composite (grouped by child table)
-- ============================================================================

BEGIN;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1 — UNIQUE(id, organization_id) ON PARENT TABLES               ║
-- ║  Composite FKs require a unique constraint on the referenced columns.    ║
-- ║  Already exist: invoices, medical_records, pets, staff                   ║
-- ║  Need: appointments, clients, clinics, conversations,                   ║
-- ║        email_integrations, messages, profiles, services                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_id_org    ON appointments (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_id_org         ON clients (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_id_org         ON clinics (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_id_org   ON conversations (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_integrations_id_org ON email_integrations (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_id_org        ON messages (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_id_org        ON profiles (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_id_org        ON services (id, organization_id);


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2 — ADD organization_id TO 7 REMAINING CHILD TABLES            ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ── 2a. medications (backfill via pets) ──

ALTER TABLE medications ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE medications m SET organization_id = p.organization_id
  FROM pets p WHERE m.pet_id = p.id AND m.organization_id IS NULL;
DELETE FROM medications WHERE organization_id IS NULL;
ALTER TABLE medications ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medications_org ON medications (organization_id);

DROP POLICY IF EXISTS "medications: org via pet" ON medications;
CREATE POLICY "medications_select" ON medications FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "medications_insert" ON medications FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "medications_update" ON medications FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "medications_delete" ON medications FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());

-- ── 2b. message_reactions (backfill via messages) ──

ALTER TABLE message_reactions ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE message_reactions mr SET organization_id = m.organization_id
  FROM messages m WHERE mr.message_id = m.id AND mr.organization_id IS NULL;
DELETE FROM message_reactions WHERE organization_id IS NULL;
ALTER TABLE message_reactions ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_reactions_org ON message_reactions (organization_id);

DROP POLICY IF EXISTS "reactions: org via message" ON message_reactions;
CREATE POLICY "message_reactions_select" ON message_reactions FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "message_reactions_insert" ON message_reactions FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "message_reactions_update" ON message_reactions FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "message_reactions_delete" ON message_reactions FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());

-- ── 2c. pet_allergies (backfill via pets) ──

ALTER TABLE pet_allergies ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE pet_allergies pa SET organization_id = p.organization_id
  FROM pets p WHERE pa.pet_id = p.id AND pa.organization_id IS NULL;
DELETE FROM pet_allergies WHERE organization_id IS NULL;
ALTER TABLE pet_allergies ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pet_allergies_org ON pet_allergies (organization_id);

DROP POLICY IF EXISTS "pet_allergies: org via pet" ON pet_allergies;
CREATE POLICY "pet_allergies_select" ON pet_allergies FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_allergies_insert" ON pet_allergies FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "pet_allergies_update" ON pet_allergies FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_allergies_delete" ON pet_allergies FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());

-- ── 2d. pet_conditions (backfill via pets) ──

ALTER TABLE pet_conditions ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE pet_conditions pc SET organization_id = p.organization_id
  FROM pets p WHERE pc.pet_id = p.id AND pc.organization_id IS NULL;
DELETE FROM pet_conditions WHERE organization_id IS NULL;
ALTER TABLE pet_conditions ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pet_conditions_org ON pet_conditions (organization_id);

DROP POLICY IF EXISTS "pet_conditions: org via pet" ON pet_conditions;
CREATE POLICY "pet_conditions_select" ON pet_conditions FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_conditions_insert" ON pet_conditions FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "pet_conditions_update" ON pet_conditions FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_conditions_delete" ON pet_conditions FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());

-- ── 2e. pet_treatments (backfill via pets) ──

ALTER TABLE pet_treatments ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE pet_treatments pt SET organization_id = p.organization_id
  FROM pets p WHERE pt.pet_id = p.id AND pt.organization_id IS NULL;
DELETE FROM pet_treatments WHERE organization_id IS NULL;
ALTER TABLE pet_treatments ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pet_treatments_org ON pet_treatments (organization_id);

DROP POLICY IF EXISTS "pet_treatments: org via pet" ON pet_treatments;
CREATE POLICY "pet_treatments_select" ON pet_treatments FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_treatments_insert" ON pet_treatments FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "pet_treatments_update" ON pet_treatments FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_treatments_delete" ON pet_treatments FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());

-- ── 2f. staff_ratings (backfill via staff) ──

ALTER TABLE staff_ratings ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE staff_ratings sr SET organization_id = s.organization_id
  FROM staff s WHERE sr.staff_id = s.id AND sr.organization_id IS NULL;
DELETE FROM staff_ratings WHERE organization_id IS NULL;
ALTER TABLE staff_ratings ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_ratings_org ON staff_ratings (organization_id);

DROP POLICY IF EXISTS "staff_ratings: org via staff" ON staff_ratings;
CREATE POLICY "staff_ratings_select" ON staff_ratings FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "staff_ratings_insert" ON staff_ratings FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "staff_ratings_update" ON staff_ratings FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "staff_ratings_delete" ON staff_ratings FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());

-- ── 2g. vaccinations (backfill via clinics) ──

ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE vaccinations v SET organization_id = c.organization_id
  FROM clinics c WHERE v.clinic_id = c.id AND v.organization_id IS NULL;
DELETE FROM vaccinations WHERE organization_id IS NULL;
ALTER TABLE vaccinations ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vaccinations_org ON vaccinations (organization_id);

DROP POLICY IF EXISTS "vaccinations: org via clinic" ON vaccinations;
CREATE POLICY "vaccinations_select" ON vaccinations FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "vaccinations_insert" ON vaccinations FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "vaccinations_update" ON vaccinations FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "vaccinations_delete" ON vaccinations FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3 — UPGRADE SINGLE-COLUMN FKs TO COMPOSITE                     ║
-- ║  Pattern: DROP old FK → ADD new FK(entity_id, organization_id)          ║
-- ║  REFERENCES parent(id, organization_id)                                  ║
-- ║  Grouped by child table, alphabetical order.                             ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ── appointments → clients, clinics, pets, services, staff ──

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_client_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients (id, organization_id);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_clinic_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_pet_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_service_org_fkey
  FOREIGN KEY (service_id, organization_id) REFERENCES services (id, organization_id);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_vet_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_vet_org_fkey
  FOREIGN KEY (vet_id, organization_id) REFERENCES staff (id, organization_id);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES staff (id, organization_id);

-- ── audit_logs → clinics, profiles ──

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_clinic_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_org_fkey
  FOREIGN KEY (actor_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── clients → clinics, profiles ──

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_clinic_id_fkey;
ALTER TABLE clients ADD CONSTRAINT clients_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_profile_id_fkey;
ALTER TABLE clients ADD CONSTRAINT clients_profile_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── conversation_participants → conversations, profiles ──

ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_fkey;
ALTER TABLE conversation_participants ADD CONSTRAINT conv_participants_conv_org_fkey
  FOREIGN KEY (conversation_id, organization_id) REFERENCES conversations (id, organization_id);

ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_profile_id_fkey;
ALTER TABLE conversation_participants ADD CONSTRAINT conv_participants_profile_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── conversations → profiles ──

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES profiles (id, organization_id);

-- ── email_integrations → profiles ──

ALTER TABLE email_integrations DROP CONSTRAINT IF EXISTS email_integrations_user_id_fkey;
ALTER TABLE email_integrations ADD CONSTRAINT email_integrations_user_org_fkey
  FOREIGN KEY (user_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── email_sync_log → email_integrations ──

ALTER TABLE email_sync_log DROP CONSTRAINT IF EXISTS email_sync_log_integration_id_fkey;
ALTER TABLE email_sync_log ADD CONSTRAINT email_sync_log_integration_org_fkey
  FOREIGN KEY (integration_id, organization_id) REFERENCES email_integrations (id, organization_id);

-- ── invoice_line_items → services (invoice FK already composite) ──

ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_service_id_fkey;
ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_service_org_fkey
  FOREIGN KEY (service_id, organization_id) REFERENCES services (id, organization_id);

-- ── invoices → appointments, clients, clinics, medical_records, staff ──

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_appointment_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_appointment_org_fkey
  FOREIGN KEY (appointment_id, organization_id) REFERENCES appointments (id, organization_id);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_client_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients (id, organization_id);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_clinic_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_record_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_record_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES staff (id, organization_id);

-- ── lab_results → clinics, medical_records, pets, profiles, staff ──

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_clinic_id_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_record_id_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_record_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_pet_id_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_uploaded_by_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_uploaded_by_org_fkey
  FOREIGN KEY (uploaded_by, organization_id) REFERENCES profiles (id, organization_id);

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_reviewed_by_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_reviewed_by_org_fkey
  FOREIGN KEY (reviewed_by, organization_id) REFERENCES profiles (id, organization_id);

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_ordered_by_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_ordered_by_org_fkey
  FOREIGN KEY (ordered_by, organization_id) REFERENCES staff (id, organization_id);

-- ── medical_records → appointments, clients, clinics, pets, staff ──

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_appointment_id_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_appointment_org_fkey
  FOREIGN KEY (appointment_id, organization_id) REFERENCES appointments (id, organization_id);

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_client_id_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_client_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients (id, organization_id);

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_clinic_id_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_pet_id_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_vet_id_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_vet_org_fkey
  FOREIGN KEY (vet_id, organization_id) REFERENCES staff (id, organization_id);

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_amended_by_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_amended_by_org_fkey
  FOREIGN KEY (amended_by, organization_id) REFERENCES staff (id, organization_id);

ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_created_by_fkey;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_created_by_org_fkey
  FOREIGN KEY (created_by, organization_id) REFERENCES staff (id, organization_id);

-- ── medications → medical_records, pets, staff (NEW org_id from Section 2) ──

ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_record_id_fkey;
ALTER TABLE medications ADD CONSTRAINT medications_record_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);

ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_pet_id_fkey;
ALTER TABLE medications ADD CONSTRAINT medications_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_prescribed_by_fkey;
ALTER TABLE medications ADD CONSTRAINT medications_prescribed_by_org_fkey
  FOREIGN KEY (prescribed_by, organization_id) REFERENCES staff (id, organization_id);

-- ── message_reactions → messages (NEW org_id from Section 2) ──

ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey;
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_message_org_fkey
  FOREIGN KEY (message_id, organization_id) REFERENCES messages (id, organization_id);

-- ── messages → conversations, messages (self-ref), profiles ──

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_conversation_org_fkey
  FOREIGN KEY (conversation_id, organization_id) REFERENCES conversations (id, organization_id);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_reply_to_org_fkey
  FOREIGN KEY (reply_to_id, organization_id) REFERENCES messages (id, organization_id);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_sender_org_fkey
  FOREIGN KEY (sender_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── notifications → profiles ──

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_profile_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_profile_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── payments → invoices, staff ──

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_invoice_org_fkey
  FOREIGN KEY (invoice_id, organization_id) REFERENCES invoices (id, organization_id);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_processed_by_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_processed_by_org_fkey
  FOREIGN KEY (processed_by, organization_id) REFERENCES staff (id, organization_id);

-- ── pending_requests → profiles ──

ALTER TABLE pending_requests DROP CONSTRAINT IF EXISTS pending_requests_requester_id_fkey;
ALTER TABLE pending_requests ADD CONSTRAINT pending_requests_requester_org_fkey
  FOREIGN KEY (requester_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── pet_allergies → pets (NEW org_id from Section 2) ──

ALTER TABLE pet_allergies DROP CONSTRAINT IF EXISTS pet_allergies_pet_id_fkey;
ALTER TABLE pet_allergies ADD CONSTRAINT pet_allergies_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

-- ── pet_conditions → pets (NEW org_id from Section 2) ──

ALTER TABLE pet_conditions DROP CONSTRAINT IF EXISTS pet_conditions_pet_id_fkey;
ALTER TABLE pet_conditions ADD CONSTRAINT pet_conditions_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

-- ── pet_notes → pets, profiles ──

ALTER TABLE pet_notes DROP CONSTRAINT IF EXISTS pet_notes_pet_id_fkey;
ALTER TABLE pet_notes ADD CONSTRAINT pet_notes_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE pet_notes DROP CONSTRAINT IF EXISTS pet_notes_author_id_fkey;
ALTER TABLE pet_notes ADD CONSTRAINT pet_notes_author_org_fkey
  FOREIGN KEY (author_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── pet_treatments → pets (NEW org_id from Section 2) ──

ALTER TABLE pet_treatments DROP CONSTRAINT IF EXISTS pet_treatments_pet_id_fkey;
ALTER TABLE pet_treatments ADD CONSTRAINT pet_treatments_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

-- ── pet_weight_history → staff (pet FK already composite) ──

ALTER TABLE pet_weight_history DROP CONSTRAINT IF EXISTS pet_weight_history_recorded_by_fkey;
ALTER TABLE pet_weight_history ADD CONSTRAINT pet_weight_history_recorded_by_org_fkey
  FOREIGN KEY (recorded_by, organization_id) REFERENCES staff (id, organization_id);

-- ── pets → clients, clinics, staff ──

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_client_id_fkey;
ALTER TABLE pets ADD CONSTRAINT pets_client_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients (id, organization_id);

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_clinic_id_fkey;
ALTER TABLE pets ADD CONSTRAINT pets_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_assigned_vet_id_fkey;
ALTER TABLE pets ADD CONSTRAINT pets_assigned_vet_org_fkey
  FOREIGN KEY (assigned_vet_id, organization_id) REFERENCES staff (id, organization_id);

-- ── record_treatments → staff (record FK already composite) ──

ALTER TABLE record_treatments DROP CONSTRAINT IF EXISTS record_treatments_performed_by_fkey;
ALTER TABLE record_treatments ADD CONSTRAINT record_treatments_performed_by_org_fkey
  FOREIGN KEY (performed_by, organization_id) REFERENCES staff (id, organization_id);

-- ── shifts → staff ──

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_staff_id_fkey;
ALTER TABLE shifts ADD CONSTRAINT shifts_staff_org_fkey
  FOREIGN KEY (staff_id, organization_id) REFERENCES staff (id, organization_id);

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_swap_with_staff_id_fkey;
ALTER TABLE shifts ADD CONSTRAINT shifts_swap_with_org_fkey
  FOREIGN KEY (swap_with_staff_id, organization_id) REFERENCES staff (id, organization_id);

-- ── staff → clinics, profiles ──

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_clinic_id_fkey;
ALTER TABLE staff ADD CONSTRAINT staff_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_profile_id_fkey;
ALTER TABLE staff ADD CONSTRAINT staff_profile_org_fkey
  FOREIGN KEY (profile_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── staff_ratings → staff, clients (NEW org_id from Section 2) ──

ALTER TABLE staff_ratings DROP CONSTRAINT IF EXISTS staff_ratings_staff_id_fkey;
ALTER TABLE staff_ratings ADD CONSTRAINT staff_ratings_staff_org_fkey
  FOREIGN KEY (staff_id, organization_id) REFERENCES staff (id, organization_id);

ALTER TABLE staff_ratings DROP CONSTRAINT IF EXISTS staff_ratings_client_fk;
ALTER TABLE staff_ratings ADD CONSTRAINT staff_ratings_client_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients (id, organization_id);

-- ── staff_time_blocks → clinics, staff ──

ALTER TABLE staff_time_blocks DROP CONSTRAINT IF EXISTS staff_time_blocks_clinic_id_fkey;
ALTER TABLE staff_time_blocks ADD CONSTRAINT staff_time_blocks_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE staff_time_blocks DROP CONSTRAINT IF EXISTS staff_time_blocks_staff_id_fkey;
ALTER TABLE staff_time_blocks ADD CONSTRAINT staff_time_blocks_staff_org_fkey
  FOREIGN KEY (staff_id, organization_id) REFERENCES staff (id, organization_id);

-- ── tasks → clients, pets, profiles ──

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_client_org_fkey
  FOREIGN KEY (client_id, organization_id) REFERENCES clients (id, organization_id);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_pet_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_completed_by_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_completed_by_org_fkey
  FOREIGN KEY (completed_by_id, organization_id) REFERENCES profiles (id, organization_id);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_by_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_by_org_fkey
  FOREIGN KEY (assigned_by_id, organization_id) REFERENCES profiles (id, organization_id);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_org_fkey
  FOREIGN KEY (assigned_to_id, organization_id) REFERENCES profiles (id, organization_id);

-- ── vaccinations → pets, clinics, medical_records, staff (NEW org_id from Section 2) ──

ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_pet_id_fkey;
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_clinic_id_fkey;
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_clinic_org_fkey
  FOREIGN KEY (clinic_id, organization_id) REFERENCES clinics (id, organization_id);

ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_record_id_fkey;
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_record_org_fkey
  FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);

ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_administered_by_fkey;
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_administered_by_org_fkey
  FOREIGN KEY (administered_by, organization_id) REFERENCES staff (id, organization_id);

-- ── visit_reports → appointments, pets, profiles ──

ALTER TABLE visit_reports DROP CONSTRAINT IF EXISTS visit_reports_appointment_id_fkey;
ALTER TABLE visit_reports ADD CONSTRAINT visit_reports_appointment_org_fkey
  FOREIGN KEY (appointment_id, organization_id) REFERENCES appointments (id, organization_id);

ALTER TABLE visit_reports DROP CONSTRAINT IF EXISTS visit_reports_pet_id_fkey;
ALTER TABLE visit_reports ADD CONSTRAINT visit_reports_pet_org_fkey
  FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);

ALTER TABLE visit_reports DROP CONSTRAINT IF EXISTS visit_reports_vet_id_fkey;
ALTER TABLE visit_reports ADD CONSTRAINT visit_reports_vet_org_fkey
  FOREIGN KEY (vet_id, organization_id) REFERENCES profiles (id, organization_id);

COMMIT;
