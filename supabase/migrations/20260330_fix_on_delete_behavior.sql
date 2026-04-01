-- ============================================================================
-- MIGRATION: Fix ON DELETE Behavior on All Foreign Keys
-- ============================================================================
--
-- DESIGN PRINCIPLES:
--   CASCADE  — child data is meaningless without the parent.
--              e.g. pet deleted → its appointments, records, vitals go too.
--   SET NULL — the child record has independent historical value and must
--              survive the parent's deletion.
--              e.g. staff leaves → invoices they created stay, vet_id → NULL.
--   NO ACTION is never appropriate — it silently blocks deletes and produces
--              confusing errors at runtime.
--
-- DECISION GUIDE (applied per-FK below):
--   ┌──────────────────────────────────────────────────────────┐
--   │ Parent       │ Child              │ Rule     │ Why       │
--   ├──────────────┼────────────────────┼──────────┼───────────┤
--   │ organization │ everything in org  │ CASCADE  │ tenant    │
--   │ clinic       │ scoped data        │ CASCADE  │ scope     │
--   │ client       │ pets, appointments │ CASCADE  │ ownership │
--   │ pet          │ records, labs, meds│ CASCADE  │ ownership │
--   │ medical_rec  │ vitals, dx, tx     │ CASCADE  │ 1:1 / 1:N│
--   │ invoice      │ line items, pays   │ CASCADE  │ document  │
--   │ conversation │ participants, msgs │ CASCADE  │ thread    │
--   │ staff/profile│ created_by, vet_id │ SET NULL │ history   │
--   │ service      │ appt.service_id    │ SET NULL │ history   │
--   │ appointment  │ invoice.appt_id    │ SET NULL │ history   │
--   │ client (fin) │ invoices.client_id │ SET NULL │ financial │
--   │ staff        │ shifts (primary)   │ CASCADE  │ schedule  │
--   │ staff        │ shifts (swap ref)  │ SET NULL │ optional  │
--   └──────────────┴────────────────────┴──────────┴───────────┘
--
-- SUMMARY OF CHANGES (11 FKs fixed):
--
--   NO ACTION → CASCADE:   shifts.staff_id, staff_time_blocks.staff_id,
--                           pet_notes.organization_id
--   NO ACTION → SET NULL:  shifts.swap_with_staff_id, pet_notes.author_id
--   CASCADE   → SET NULL:  invoices.client_id, lab_results.clinic_id,
--                           medications.record_id, messages.sender_id,
--                           staff.clinic_id
--   SET NULL  → CASCADE:   audit_logs.organization_id
--
-- NOTE: visit_reports FKs are excluded — that table is dropped by the
--       20260330_deduplicate_medical_data migration.
--
-- ALREADY CORRECT (53 FKs, no changes):
--   All organization_id → CASCADE (except audit_logs, fixed below)
--   All *_by / vet_id → staff/profiles SET NULL
--   All pet child data → CASCADE
--   All medical_records child tables → CASCADE
--   All invoice internals → CASCADE
--   All conversation internals → CASCADE
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Make columns nullable where SET NULL requires it
-- ════════════════════════════════════════════════════════════════════════════
-- SET NULL fails at runtime if the target column is NOT NULL.
-- These columns need to become nullable to support historical preservation.

-- invoices.client_id: invoices must survive client deletion for accounting
ALTER TABLE invoices
  ALTER COLUMN client_id DROP NOT NULL;

-- messages.sender_id: chat history must survive user deletion
ALTER TABLE messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- pet_notes.author_id: notes must survive author profile deletion
ALTER TABLE pet_notes
  ALTER COLUMN author_id DROP NOT NULL;

-- staff.clinic_id: staff must survive clinic closure / restructuring
ALTER TABLE staff
  ALTER COLUMN clinic_id DROP NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Fix NO ACTION → CASCADE (dependent data, must not orphan)
-- ════════════════════════════════════════════════════════════════════════════

-- shifts.staff_id → staff: a shift belongs to a staff member.
-- Deleting staff means their schedule is meaningless.
ALTER TABLE shifts DROP CONSTRAINT shifts_staff_id_fkey;
ALTER TABLE shifts ADD CONSTRAINT shifts_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- staff_time_blocks.staff_id → staff: availability blocks belong to staff.
ALTER TABLE staff_time_blocks DROP CONSTRAINT staff_time_blocks_staff_id_fkey;
ALTER TABLE staff_time_blocks ADD CONSTRAINT staff_time_blocks_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- pet_notes.organization_id → organizations: org deleted = all data goes.
ALTER TABLE pet_notes DROP CONSTRAINT pet_notes_organization_id_fkey;
ALTER TABLE pet_notes ADD CONSTRAINT pet_notes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Fix NO ACTION → SET NULL (preserve record, clear reference)
-- ════════════════════════════════════════════════════════════════════════════

-- shifts.swap_with_staff_id → staff: if the swap-target staff is deleted,
-- the shift stays but the swap reference is cleared.
ALTER TABLE shifts DROP CONSTRAINT shifts_swap_with_staff_id_fkey;
ALTER TABLE shifts ADD CONSTRAINT shifts_swap_with_staff_id_fkey
  FOREIGN KEY (swap_with_staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- pet_notes.author_id → profiles: if the author profile is deleted,
-- the note stays with author_id = NULL (shows as "Deleted User").
ALTER TABLE pet_notes DROP CONSTRAINT pet_notes_author_id_fkey;
ALTER TABLE pet_notes ADD CONSTRAINT pet_notes_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 4: Fix CASCADE → SET NULL (preserve historical / financial data)
-- ════════════════════════════════════════════════════════════════════════════

-- invoices.client_id → clients: invoices are financial/tax records.
-- Deleting a client must NOT destroy their invoices.
-- The invoice stays with client_id = NULL; the client name was already
-- denormalized into the invoice PDF / display.
ALTER TABLE invoices DROP CONSTRAINT invoices_client_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- lab_results.clinic_id → clinics: lab data is medical history.
-- If a clinic is restructured or removed, labs must persist.
ALTER TABLE lab_results DROP CONSTRAINT lab_results_clinic_id_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;

-- medications.record_id → medical_records: a prescription may outlive
-- the visit record it was created from (e.g. active ongoing med).
ALTER TABLE medications DROP CONSTRAINT medications_record_id_fkey;
ALTER TABLE medications ADD CONSTRAINT medications_record_id_fkey
  FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE SET NULL;

-- messages.sender_id → profiles: chat messages must survive user deletion
-- to preserve conversation flow. Shows as "Deleted User" in UI.
ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- staff.clinic_id → clinics: if a clinic is closed, staff should be
-- preserved and reassigned, not deleted along with the clinic.
ALTER TABLE staff DROP CONSTRAINT staff_clinic_id_fkey;
ALTER TABLE staff ADD CONSTRAINT staff_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Fix SET NULL → CASCADE (data belongs to the tenant scope)
-- ════════════════════════════════════════════════════════════════════════════

-- audit_logs.organization_id → organizations: audit logs are org-scoped.
-- If the entire org is deleted (tenant offboarded), its audit trail goes too.
-- Keeping orphaned audit logs with NULL org_id would violate tenant isolation.
ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_organization_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

COMMIT;
