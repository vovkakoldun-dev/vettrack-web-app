-- ============================================================================
-- MIGRATION: Standardize Staff / Profile FK References
-- ============================================================================
--
-- PROBLEM:  Some operational columns reference profiles(id) when they should
--           reference staff(id). Every person who assigns tasks or authors
--           clinical notes is a staff member — their staff.id is the correct
--           FK target, not their generic profile.
--
-- RULE:
--   profiles(id) = identity / auth scope (login, chat, notifications)
--   staff(id)    = organizational role  (clinical work, tasks, notes)
--
-- DECISION TABLE:
--   ┌─────────────────────────┬────────────────┬────────────────┬──────────┐
--   │ Column                  │ Was            │ Now            │ Why      │
--   ├─────────────────────────┼────────────────┼────────────────┼──────────┤
--   │ tasks.assigned_by_id    │ profiles(id)   │ staff(id)      │ doctors  │
--   │ tasks.assigned_to_id    │ profiles(id)   │ staff(id)      │ staff    │
--   │ pet_notes.author_id     │ profiles(id)   │ staff(id)      │ clinical │
--   └─────────────────────────┴────────────────┴────────────────┴──────────┘
--
-- COLUMNS CORRECTLY LEFT ON profiles(id) — NO CHANGES:
--   clients.profile_id            (client identity link)
--   conversation_participants     (any user can chat)
--   conversations.created_by      (any user can start a chat)
--   messages.sender_id            (any user can send messages)
--   notifications.profile_id      (any user receives notifications)
--   audit_logs.actor_id           (any user can trigger audit events)
--   staff.profile_id              (the identity ↔ role join column)
--
-- COLUMNS ALREADY ON staff(id) — NO CHANGES NEEDED:
--   appointments.vet_id, appointments.created_by,
--   medical_records.vet_id, medical_records.created_by, medical_records.amended_by,
--   medications.prescribed_by, lab_results.ordered_by,
--   vaccinations.administered_by, record_treatments.performed_by,
--   pets.assigned_vet_id, invoices.created_by,
--   shifts.staff_id, shifts.swap_with_staff_id,
--   staff_time_blocks.staff_id
--
-- NOTE: visit_reports.vet_id was also profiles(id), but that table is
--       dropped by 20260330_deduplicate_medical_data.sql — no action needed.
--
-- DEPENDS ON:
--   20260330_multitenant_composite_fks.sql  (creates the current composite FKs)
--   20260330_fix_on_delete_behavior.sql     (fixes ON DELETE for pet_notes.author_id)
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Migrate data — replace profile IDs with staff IDs
-- ════════════════════════════════════════════════════════════════════════════
-- The columns currently store profiles.id values. Staff records link to
-- profiles via staff.profile_id. We look up the corresponding staff.id
-- for each profile.id, scoped to the same organization.
--
-- If a profile has no staff record (shouldn't happen for task/note authors,
-- but defensive), the column is set to NULL rather than leaving an orphan.

-- ── tasks.assigned_by_id ──
UPDATE tasks t
SET assigned_by_id = s.id
FROM staff s
WHERE s.profile_id = t.assigned_by_id
  AND s.organization_id = t.organization_id;

-- Clear any that didn't match (profile exists but has no staff record)
UPDATE tasks t
SET assigned_by_id = NULL
WHERE assigned_by_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = t.assigned_by_id
      AND s.organization_id = t.organization_id
  );

-- ── tasks.assigned_to_id ──
UPDATE tasks t
SET assigned_to_id = s.id
FROM staff s
WHERE s.profile_id = t.assigned_to_id
  AND s.organization_id = t.organization_id;

UPDATE tasks t
SET assigned_to_id = NULL
WHERE assigned_to_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = t.assigned_to_id
      AND s.organization_id = t.organization_id
  );

-- ── pet_notes.author_id ──
UPDATE pet_notes pn
SET author_id = s.id
FROM staff s
WHERE s.profile_id = pn.author_id
  AND s.organization_id = pn.organization_id;

UPDATE pet_notes pn
SET author_id = NULL
WHERE author_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = pn.author_id
      AND s.organization_id = pn.organization_id
  );

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Drop old FK constraints (referencing profiles)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE tasks     DROP CONSTRAINT tasks_assigned_by_id_org_fkey;
ALTER TABLE tasks     DROP CONSTRAINT tasks_assigned_to_id_org_fkey;
ALTER TABLE pet_notes DROP CONSTRAINT pet_notes_author_id_org_fkey;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Add new FK constraints (referencing staff)
-- ════════════════════════════════════════════════════════════════════════════
-- All use composite (column, organization_id) → staff(id, organization_id)
-- ON DELETE SET NULL — tasks and notes have independent historical value
-- and must survive staff deletion.

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_by_id_org_fkey
  FOREIGN KEY (assigned_by_id, organization_id)
  REFERENCES staff(id, organization_id)
  ON DELETE SET NULL (assigned_by_id);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_to_id_org_fkey
  FOREIGN KEY (assigned_to_id, organization_id)
  REFERENCES staff(id, organization_id)
  ON DELETE SET NULL (assigned_to_id);

ALTER TABLE pet_notes
  ADD CONSTRAINT pet_notes_author_id_org_fkey
  FOREIGN KEY (author_id, organization_id)
  REFERENCES staff(id, organization_id)
  ON DELETE SET NULL (author_id);

COMMIT;
