-- ============================================================================
-- Migration: fix_malformed_composite_fk_constraints
-- Date: 2026-04-10
--
-- Problem: Every org-scoped FK was created as a composite FK that produces
-- 4 cross-joined permutations (col→ref.id, col→ref.org_id, org→ref.id,
-- org→ref.org_id). Only the simple column→PK mapping is correct.
-- The organization_id→organizations(id) FK already exists separately.
--
-- Fix: Drop each malformed _org_fkey, replace with a simple single-column FK.
-- ============================================================================

BEGIN;

-- ── appointments ──────────────────────────────────────────────
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_org_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_clinic_org_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_created_by_org_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_pet_org_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_service_org_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_vet_org_fkey;

ALTER TABLE appointments ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES staff(id);

-- ── audit_logs ────────────────────────────────────────────────
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_org_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_clinic_org_fkey;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- ── clients ───────────────────────────────────────────────────
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_clinic_org_fkey;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_profile_org_fkey;

ALTER TABLE clients ADD CONSTRAINT clients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE clients ADD CONSTRAINT clients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);

-- ── conversation_participants ─────────────────────────────────
ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conv_participants_conv_org_fkey;
ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conv_participants_profile_org_fkey;

ALTER TABLE conversation_participants ADD CONSTRAINT conv_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id);
ALTER TABLE conversation_participants ADD CONSTRAINT conv_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);

-- ── conversations ─────────────────────────────────────────────
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_created_by_org_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

-- ── email_integrations ────────────────────────────────────────
ALTER TABLE email_integrations DROP CONSTRAINT IF EXISTS email_integrations_user_org_fkey;
ALTER TABLE email_integrations ADD CONSTRAINT email_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);

-- ── email_sync_log ────────────────────────────────────────────
ALTER TABLE email_sync_log DROP CONSTRAINT IF EXISTS email_sync_log_integration_org_fkey;
ALTER TABLE email_sync_log ADD CONSTRAINT email_sync_log_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES email_integrations(id);

-- ── invoice_line_items ────────────────────────────────────────
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_invoice_org_fkey;
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_service_org_fkey;

ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);

-- ── invoices ──────────────────────────────────────────────────
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_appointment_org_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_org_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_clinic_org_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_org_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_record_org_fkey;

ALTER TABLE invoices ADD CONSTRAINT invoices_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- ── lab_results ───────────────────────────────────────────────
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_clinic_org_fkey;
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_ordered_by_org_fkey;
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_pet_org_fkey;
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_record_org_fkey;
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_reviewed_by_org_fkey;
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_uploaded_by_org_fkey;

ALTER TABLE lab_results ADD CONSTRAINT lab_results_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE lab_results ADD CONSTRAINT lab_results_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES staff(id);
ALTER TABLE lab_results ADD CONSTRAINT lab_results_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE lab_results ADD CONSTRAINT lab_results_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);
ALTER TABLE lab_results ADD CONSTRAINT lab_results_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
ALTER TABLE lab_results ADD CONSTRAINT lab_results_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id);

-- ── medical_records ───────────────────────────────────────────
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_amended_by_org_fkey;
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_appointment_org_fkey;
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_client_org_fkey;
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_clinic_org_fkey;
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_created_by_org_fkey;
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_pet_org_fkey;
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_vet_org_fkey;

ALTER TABLE medical_records ADD CONSTRAINT medical_records_amended_by_fkey FOREIGN KEY (amended_by) REFERENCES staff(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES staff(id);

-- ── medications ───────────────────────────────────────────────
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_pet_org_fkey;
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_prescribed_by_org_fkey;
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_record_org_fkey;

ALTER TABLE medications ADD CONSTRAINT medications_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE medications ADD CONSTRAINT medications_prescribed_by_fkey FOREIGN KEY (prescribed_by) REFERENCES staff(id);
ALTER TABLE medications ADD CONSTRAINT medications_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- ── message_reactions ─────────────────────────────────────────
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_org_fkey;
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id);

-- ── messages ──────────────────────────────────────────────────
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_org_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_reply_to_org_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_org_fkey;

ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id);
ALTER TABLE messages ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES messages(id);
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id);

-- ── notifications ─────────────────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_profile_org_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);

-- ── payments ──────────────────────────────────────────────────
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_invoice_org_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_processed_by_org_fkey;

ALTER TABLE payments ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE payments ADD CONSTRAINT payments_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES staff(id);

-- ── pending_requests ──────────────────────────────────────────
ALTER TABLE pending_requests DROP CONSTRAINT IF EXISTS pending_requests_requester_org_fkey;
ALTER TABLE pending_requests ADD CONSTRAINT pending_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES profiles(id);

-- ── pet_allergies ─────────────────────────────────────────────
ALTER TABLE pet_allergies DROP CONSTRAINT IF EXISTS pet_allergies_pet_org_fkey;
ALTER TABLE pet_allergies ADD CONSTRAINT pet_allergies_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);

-- ── pet_conditions ────────────────────────────────────────────
ALTER TABLE pet_conditions DROP CONSTRAINT IF EXISTS pet_conditions_pet_org_fkey;
ALTER TABLE pet_conditions ADD CONSTRAINT pet_conditions_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);

-- ── pet_notes ─────────────────────────────────────────────────
ALTER TABLE pet_notes DROP CONSTRAINT IF EXISTS pet_notes_author_org_fkey;
ALTER TABLE pet_notes DROP CONSTRAINT IF EXISTS pet_notes_pet_org_fkey;

ALTER TABLE pet_notes ADD CONSTRAINT pet_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id);
ALTER TABLE pet_notes ADD CONSTRAINT pet_notes_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);

-- ── pet_treatments ────────────────────────────────────────────
ALTER TABLE pet_treatments DROP CONSTRAINT IF EXISTS pet_treatments_pet_org_fkey;
ALTER TABLE pet_treatments ADD CONSTRAINT pet_treatments_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);

-- ── pet_weight_history ────────────────────────────────────────
ALTER TABLE pet_weight_history DROP CONSTRAINT IF EXISTS pet_weight_history_pet_org_fkey;
ALTER TABLE pet_weight_history DROP CONSTRAINT IF EXISTS pet_weight_history_recorded_by_org_fkey;

ALTER TABLE pet_weight_history ADD CONSTRAINT pet_weight_history_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE pet_weight_history ADD CONSTRAINT pet_weight_history_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES staff(id);

-- ── pets ──────────────────────────────────────────────────────
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_assigned_vet_org_fkey;
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_client_org_fkey;
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_clinic_org_fkey;

ALTER TABLE pets ADD CONSTRAINT pets_assigned_vet_id_fkey FOREIGN KEY (assigned_vet_id) REFERENCES staff(id);
ALTER TABLE pets ADD CONSTRAINT pets_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE pets ADD CONSTRAINT pets_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- ── record_diagnoses ──────────────────────────────────────────
ALTER TABLE record_diagnoses DROP CONSTRAINT IF EXISTS record_diagnoses_record_org_fkey;
ALTER TABLE record_diagnoses ADD CONSTRAINT record_diagnoses_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- ── record_treatments ─────────────────────────────────────────
ALTER TABLE record_treatments DROP CONSTRAINT IF EXISTS record_treatments_performed_by_org_fkey;
ALTER TABLE record_treatments DROP CONSTRAINT IF EXISTS record_treatments_record_org_fkey;

ALTER TABLE record_treatments ADD CONSTRAINT record_treatments_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES staff(id);
ALTER TABLE record_treatments ADD CONSTRAINT record_treatments_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- ── record_vitals ─────────────────────────────────────────────
ALTER TABLE record_vitals DROP CONSTRAINT IF EXISTS record_vitals_record_org_fkey;
ALTER TABLE record_vitals ADD CONSTRAINT record_vitals_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- ── shifts ────────────────────────────────────────────────────
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_staff_org_fkey;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_swap_with_org_fkey;

ALTER TABLE shifts ADD CONSTRAINT shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id);
ALTER TABLE shifts ADD CONSTRAINT shifts_swap_with_staff_id_fkey FOREIGN KEY (swap_with_staff_id) REFERENCES staff(id);

-- ── staff ─────────────────────────────────────────────────────
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_clinic_org_fkey;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_profile_org_fkey;

ALTER TABLE staff ADD CONSTRAINT staff_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE staff ADD CONSTRAINT staff_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);

-- ── staff_ratings ─────────────────────────────────────────────
ALTER TABLE staff_ratings DROP CONSTRAINT IF EXISTS staff_ratings_client_org_fkey;
ALTER TABLE staff_ratings DROP CONSTRAINT IF EXISTS staff_ratings_staff_org_fkey;

ALTER TABLE staff_ratings ADD CONSTRAINT staff_ratings_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE staff_ratings ADD CONSTRAINT staff_ratings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id);

-- ── staff_specializations ─────────────────────────────────────
ALTER TABLE staff_specializations DROP CONSTRAINT IF EXISTS staff_specializations_staff_org_fkey;
ALTER TABLE staff_specializations ADD CONSTRAINT staff_specializations_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id);

-- ── staff_time_blocks ─────────────────────────────────────────
ALTER TABLE staff_time_blocks DROP CONSTRAINT IF EXISTS staff_time_blocks_clinic_org_fkey;
ALTER TABLE staff_time_blocks DROP CONSTRAINT IF EXISTS staff_time_blocks_staff_org_fkey;

ALTER TABLE staff_time_blocks ADD CONSTRAINT staff_time_blocks_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE staff_time_blocks ADD CONSTRAINT staff_time_blocks_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id);

-- ── tasks ─────────────────────────────────────────────────────
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_by_org_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_org_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_org_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_completed_by_org_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_pet_org_fkey;

ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES profiles(id);
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES profiles(id);
ALTER TABLE tasks ADD CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE tasks ADD CONSTRAINT tasks_completed_by_id_fkey FOREIGN KEY (completed_by_id) REFERENCES profiles(id);
ALTER TABLE tasks ADD CONSTRAINT tasks_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);

-- ── vaccinations ──────────────────────────────────────────────
ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_administered_by_org_fkey;
ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_clinic_org_fkey;
ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_pet_org_fkey;
ALTER TABLE vaccinations DROP CONSTRAINT IF EXISTS vaccinations_record_org_fkey;

ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES staff(id);
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE vaccinations ADD CONSTRAINT vaccinations_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- ── visit_reports ─────────────────────────────────────────────
ALTER TABLE visit_reports DROP CONSTRAINT IF EXISTS visit_reports_appointment_org_fkey;
ALTER TABLE visit_reports DROP CONSTRAINT IF EXISTS visit_reports_pet_org_fkey;
ALTER TABLE visit_reports DROP CONSTRAINT IF EXISTS visit_reports_vet_org_fkey;

ALTER TABLE visit_reports ADD CONSTRAINT visit_reports_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);
ALTER TABLE visit_reports ADD CONSTRAINT visit_reports_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id);
ALTER TABLE visit_reports ADD CONSTRAINT visit_reports_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES profiles(id);

COMMIT;
