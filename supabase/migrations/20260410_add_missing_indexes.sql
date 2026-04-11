-- ============================================================================
-- Migration: add_missing_indexes
-- Date: 2026-04-10
--
-- Most requested indexes already exist. Only tasks(status, due_date) was
-- truly missing. Using IF NOT EXISTS for safety on all.
-- ============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_appt_scheduled_at ON appointments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appt_vet_id ON appointments (vet_id);
CREATE INDEX IF NOT EXISTS idx_appt_client_id ON appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appt_pet_id ON appointments (pet_id);

CREATE INDEX IF NOT EXISTS idx_medrec_pet_id ON medical_records (pet_id);
CREATE INDEX IF NOT EXISTS idx_medrec_visit_date ON medical_records (visit_date);
CREATE INDEX IF NOT EXISTS idx_medrec_client_id ON medical_records (client_id);

CREATE INDEX IF NOT EXISTS idx_inv_client_id ON invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices (status);

CREATE INDEX IF NOT EXISTS idx_lab_pet_id ON lab_results (pet_id);
CREATE INDEX IF NOT EXISTS idx_med_pet_id ON medications (pet_id);

-- NEW: composite index for task list queries filtered by status + due date
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks (status, due_date);

CREATE INDEX IF NOT EXISTS idx_vax_pet_id ON vaccinations (pet_id);
CREATE INDEX IF NOT EXISTS idx_vax_next_due ON vaccinations (next_due_date);

CREATE INDEX IF NOT EXISTS idx_shifts_staff_date_v2 ON shifts (staff_id, date);
CREATE INDEX IF NOT EXISTS idx_pets_client_id ON pets (client_id);

COMMIT;
