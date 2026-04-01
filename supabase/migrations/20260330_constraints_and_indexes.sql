-- ============================================================================
-- MIGRATION: Add Missing Constraints & Indexes
-- ============================================================================
--
-- 1. UNIQUE constraints    — prevent duplicate business records
-- 2. CHECK constraints     — enforce non-negative numerics & valid text enums
-- 3. Indexes               — FK columns, org_id, created_at, composite
--
-- Already existing (no changes):
--   UNIQUE: conversation_participants(conv, profile), invoices(invoice_number),
--           medical_records(record_number), profiles(email), pets(microchip_no),
--           services(org, sku), staff_specializations(staff, spec),
--           record_vitals(record_id), notification_preferences(user_id),
--           organization_billing(organization_id), organizations(slug)
--   CHECK:  invoice_line_items(quantity > 0), invoices(total >= 0, amount_paid >= 0),
--           payments(amount > 0), record_vitals(bcs 1-9, pain 0-10),
--           staff_ratings(rating 1-5), clients(health_status), pet_conditions(status),
--           pet_notes(type)
--   INDEX:  All organization_id (except pending_requests), all PKs,
--           appointments(client, clinic, org, pet, scheduled_at, status, vet),
--           messages(conv, created_at, sender, org), notifications(profile, read, created_at)
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1: UNIQUE CONSTRAINTS
-- ════════════════════════════════════════════════════════════════════════════

-- One staff record per person per organization
ALTER TABLE staff
  ADD CONSTRAINT uq_staff_org_profile
  UNIQUE (organization_id, profile_id);

-- One client email per organization (prevent duplicate client registrations)
ALTER TABLE clients
  ADD CONSTRAINT uq_clients_org_email
  UNIQUE (organization_id, email);

-- One billing config per organization (already exists via organization_billing_organization_id_key)
-- One settings key per org (already exists via organization_settings_organization_id_key_key)

-- Prevent duplicate shift assignments for same staff on same date + time
ALTER TABLE shifts
  ADD CONSTRAINT uq_shifts_staff_date_start
  UNIQUE (staff_id, date, start_time);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2: CHECK CONSTRAINTS — Non-negative numerics
-- ════════════════════════════════════════════════════════════════════════════

-- ── services ──
ALTER TABLE services
  ADD CONSTRAINT chk_services_price_nonneg
    CHECK (price >= 0),
  ADD CONSTRAINT chk_services_duration_pos
    CHECK (duration_minutes > 0);

-- ── appointments ──
ALTER TABLE appointments
  ADD CONSTRAINT chk_appt_duration_pos
    CHECK (duration_minutes > 0);

-- ── medical_records ──
ALTER TABLE medical_records
  ADD CONSTRAINT chk_mr_duration_pos
    CHECK (duration_minutes > 0);

-- ── medications ──
ALTER TABLE medications
  ADD CONSTRAINT chk_meds_duration_pos
    CHECK (duration_days > 0),
  ADD CONSTRAINT chk_meds_refills_nonneg
    CHECK (refills_remaining >= 0);

-- ── invoice_line_items (quantity already checked) ──
ALTER TABLE invoice_line_items
  ADD CONSTRAINT chk_li_unit_price_nonneg
    CHECK (unit_price >= 0),
  ADD CONSTRAINT chk_li_total_nonneg
    CHECK (total >= 0),
  ADD CONSTRAINT chk_li_tax_rate_nonneg
    CHECK (tax_rate >= 0 AND tax_rate <= 1);

-- ── invoices (total & amount_paid already checked) ──
ALTER TABLE invoices
  ADD CONSTRAINT chk_inv_subtotal_nonneg
    CHECK (subtotal >= 0),
  ADD CONSTRAINT chk_inv_tax_nonneg
    CHECK (tax_amount >= 0),
  ADD CONSTRAINT chk_inv_discount_nonneg
    CHECK (discount_amount >= 0);

-- ── platform_invoices ──
ALTER TABLE platform_invoices
  ADD CONSTRAINT chk_pi_seat_cost_nonneg
    CHECK (seat_cost >= 0),
  ADD CONSTRAINT chk_pi_client_cost_nonneg
    CHECK (client_cost >= 0),
  ADD CONSTRAINT chk_pi_total_nonneg
    CHECK (total >= 0);

-- ── organization_billing ──
ALTER TABLE organization_billing
  ADD CONSTRAINT chk_ob_seat_count_nonneg
    CHECK (seat_count >= 0),
  ADD CONSTRAINT chk_ob_client_count_nonneg
    CHECK (client_count >= 0),
  ADD CONSTRAINT chk_ob_price_seat_nonneg
    CHECK (price_per_seat >= 0),
  ADD CONSTRAINT chk_ob_price_client_nonneg
    CHECK (price_per_client_block >= 0);

-- ── pets / weights ──
ALTER TABLE pets
  ADD CONSTRAINT chk_pets_weight_pos
    CHECK (weight_kg > 0);

ALTER TABLE pet_weight_history
  ADD CONSTRAINT chk_pwh_weight_pos
    CHECK (weight_kg > 0);

-- ── record_vitals (bcs & pain already checked) ──
ALTER TABLE record_vitals
  ADD CONSTRAINT chk_rv_weight_pos
    CHECK (weight_kg > 0),
  ADD CONSTRAINT chk_rv_temp_pos
    CHECK (temperature_c > 0),
  ADD CONSTRAINT chk_rv_crt_nonneg
    CHECK (capillary_refill_time_s >= 0);

-- ── staff aggregates ──
ALTER TABLE staff
  ADD CONSTRAINT chk_staff_rating_range
    CHECK (avg_rating >= 0 AND avg_rating <= 5),
  ADD CONSTRAINT chk_staff_appts_nonneg
    CHECK (total_appointments >= 0);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3: CHECK CONSTRAINTS — Valid text enum values
-- ════════════════════════════════════════════════════════════════════════════
-- These columns use TEXT instead of PG enums. CHECK constraints give the
-- same data integrity without the pain of ALTER TYPE for future additions.

-- ── tasks ──
ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_type CHECK (type IN (
    'Follow-up Call', 'Medication Refill', 'Lab Follow-up',
    'Schedule Appointment', 'Owner Notification', 'Prescription Ready',
    'Referral', 'Home Care Check'
  )),
  ADD CONSTRAINT chk_tasks_status CHECK (status IN (
    'Pending', 'In Progress', 'Completed'
  )),
  ADD CONSTRAINT chk_tasks_priority CHECK (priority IN (
    'Urgent', 'High', 'Normal', 'Low'
  ));

-- ── shifts ──
ALTER TABLE shifts
  ADD CONSTRAINT chk_shifts_status CHECK (status IN (
    'Active', 'Swap Pending', 'Swapped', 'Cancelled'
  ));

-- ── clinics ──
ALTER TABLE clinics
  ADD CONSTRAINT chk_clinics_status CHECK (status IN (
    'active', 'inactive', 'suspended'
  ));

-- ── login_activity ──
ALTER TABLE login_activity
  ADD CONSTRAINT chk_login_status CHECK (status IN (
    'success', 'failure', 'locked'
  ));

-- ── pending_requests ──
ALTER TABLE pending_requests
  ADD CONSTRAINT chk_pr_status CHECK (status IN (
    'pending', 'approved', 'declined', 'cancelled'
  )),
  ADD CONSTRAINT chk_pr_type CHECK (type IN (
    'pto', 'shift_swap', 'schedule_change'
  ));

-- ── staff_time_blocks ──
ALTER TABLE staff_time_blocks
  ADD CONSTRAINT chk_stb_type CHECK (type IN (
    'Work Hours', 'Lunch Break', 'PTO', 'Meeting', 'Training', 'Break'
  )),
  ADD CONSTRAINT chk_stb_status CHECK (status IN (
    'Pending', 'Confirmed', 'Cancelled'
  ));

-- ── notification_state ──
ALTER TABLE notification_state
  ADD CONSTRAINT chk_ns_status CHECK (status IN (
    'unread', 'read', 'dismissed'
  ));

-- ── record_vitals.hydration_status ──
ALTER TABLE record_vitals
  ADD CONSTRAINT chk_rv_hydration CHECK (hydration_status IN (
    'Normal', 'Mild Dehydration', 'Moderate Dehydration', 'Severe Dehydration'
  ));

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4: INDEXES — Missing FK columns
-- ════════════════════════════════════════════════════════════════════════════
-- Only index FK columns that appear in WHERE/JOIN clauses or support CASCADE
-- delete performance. Skip low-value columns (created_by, amended_by, etc.)
-- that are never filtered on.

-- High-value FK lookups (used in queries / cascade deletes)
CREATE INDEX IF NOT EXISTS idx_medical_records_appointment_id
  ON medical_records (appointment_id);

CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id
  ON invoices (appointment_id);

CREATE INDEX IF NOT EXISTS idx_invoices_record_id
  ON invoices (record_id);

CREATE INDEX IF NOT EXISTS idx_pets_assigned_vet_id
  ON pets (assigned_vet_id);

CREATE INDEX IF NOT EXISTS idx_staff_time_blocks_staff_id
  ON staff_time_blocks (staff_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_id
  ON tasks (assigned_to_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by_id
  ON tasks (assigned_by_id);

CREATE INDEX IF NOT EXISTS idx_appointments_service_id
  ON appointments (service_id);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5: INDEXES — Missing organization_id
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_pending_requests_org_id
  ON pending_requests (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6: INDEXES — created_at for time-range queries
-- ════════════════════════════════════════════════════════════════════════════
-- Only on tables actively queried with ORDER BY / WHERE on created_at.

CREATE INDEX IF NOT EXISTS idx_appointments_created_at
  ON appointments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at
  ON invoices (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at
  ON tasks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medications_created_at
  ON medications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at
  ON conversations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pet_notes_created_at
  ON pet_notes (created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 7: COMPOSITE INDEXES — Common query patterns
-- ════════════════════════════════════════════════════════════════════════════

-- Tasks page: filter by org + sort by due date
CREATE INDEX IF NOT EXISTS idx_tasks_org_due_date
  ON tasks (organization_id, due_date);

-- Notification badge: unread count per user
CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON notifications (profile_id, is_read)
  WHERE is_read = false;

-- Chat: messages in a conversation ordered by time
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages (conversation_id, created_at DESC);

-- Appointments page: org + date range (most common query)
CREATE INDEX IF NOT EXISTS idx_appointments_org_scheduled
  ON appointments (organization_id, scheduled_at);

-- Invoices page: org + status filter
CREATE INDEX IF NOT EXISTS idx_invoices_org_status
  ON invoices (organization_id, status);

-- Medical records: pet + visit date (patient history view)
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_date
  ON medical_records (pet_id, visit_date DESC);

-- Vaccinations: pet + next due (overdue vaccine queries from Sidebar)
CREATE INDEX IF NOT EXISTS idx_vaccinations_pet_due
  ON vaccinations (pet_id, next_due_date);

-- Shifts: org + staff + date (shift calendar lookups)
-- Already exists: idx_shifts_org_date, idx_shifts_staff_date ✓

-- Active medications per pet (medication list on pet profile)
CREATE INDEX IF NOT EXISTS idx_medications_pet_active
  ON medications (pet_id, is_active)
  WHERE is_active = true;

COMMIT;
