-- ============================================================================
-- Migration: add_updated_at_columns
-- Date: 2026-04-10
--
-- Add updated_at (default now()) to tables that are missing it.
-- Existing rows get current timestamp as default.
-- ============================================================================

BEGIN;

ALTER TABLE vaccinations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE pet_treatments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE pet_allergies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE pet_weight_history
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE staff_specializations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE staff_ratings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMIT;
