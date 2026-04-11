-- ============================================================================
-- Migration: add_performance_indexes
-- Date: 2026-04-11
--
-- Adds missing performance indexes. All other requested indexes were verified
-- to already exist (many were created in earlier migrations). Only truly
-- missing indexes are included here.
--
-- Existing coverage (not duplicated):
--   appointments  — scheduled_at, status, vet_id, client_id, pet_id, clinic_id, organization_id  ✓
--   medical_records — pet_id, client_id, visit_date, clinic_id, organization_id                   ✓
--   invoices      — client_id, status, clinic_id, organization_id                                 ✓
--   lab_results   — pet_id                                                                        ✓
--   medications   — pet_id, organization_id                                                       ✓
--   tasks         — (status, due_date), organization_id                                           ✓
--   vaccinations  — pet_id, next_due_date, organization_id                                        ✓
--   shifts        — (staff_id, date), (organization_id, date)                                     ✓
--   pets          — client_id, organization_id                                                    ✓
--   clients       — organization_id                                                               ✓
--   staff         — organization_id, clinic_id                                                    ✓
--   messages      — conversation_id, organization_id                                              ✓
--   notifications — profile_id, organization_id                                                   ✓
--   payments      — invoice_id, organization_id                                                   ✓
--   pet_conditions      — pet_id                                                                  ✓
--   pet_weight_history  — pet_id                                                                  ✓
-- ============================================================================

-- ── lab_results: organization_id ─────────────────────────────
-- No org-scoped index exists; needed for RLS and org-filtered queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lab_results_organization_id
  ON lab_results (organization_id);

-- ── tasks: assigned_to_id ────────────────────────────────────
-- Enables fast lookup of tasks assigned to a specific front-desk user.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_to_id
  ON tasks (assigned_to_id);

-- ── staff_time_blocks: staff_id ──────────────────────────────
-- Enables fast lookup of time blocks for a given staff member.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_time_blocks_staff_id
  ON staff_time_blocks (staff_id);

-- ── staff_time_blocks: (organization_id, date) ──────────────
-- Composite index for org-scoped date range queries (schedule views).
-- Supersedes the existing single-column idx_staff_time_blocks_organization_id
-- for date-filtered queries while still serving org-only lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_time_blocks_org_date
  ON staff_time_blocks (organization_id, date);
